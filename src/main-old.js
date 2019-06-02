"use strict";

const cp = require("child_process");
const fs = require("fs");
const url = require("url");
const path = require("path");
const crypto = require("crypto");
const request = require("request"); // 3rd-party
const GalleryIdentifier = require("./api/gallery-identifier").GalleryIdentifier;
const getFromJson = require("./api/gallery-info/get-from-json");
const commonJson = require("./api/gallery-info/common-json");

const sevenZipExes = [
	"7z",
	"C:\\Program Files\\7-Zip\\7z.exe",
	"C:\\Program Files (x86)\\7-Zip\\7z.exe",
	// Add another entry here if 7z is installed somewhere else
];

let exCookieString = null;
try {
	exCookieString = fs.readFileSync(path.resolve(__dirname, "../cookies.txt"), { encoding: "utf8" }).trim();
	if (!exCookieString) { exCookieString = null; }
} catch (e) {}


function trySpawnSync(executables, args, options) {
	let result = null;
	for (const exe of executables) {
		result = cp.spawnSync(exe, args, options);
		if (!result.error) { break; }
	}
	return result;
}

function getIndexOfMatch(array, regex, start) {
	for (let i = start; i < array.length; ++i) {
		if (regex.test(array[i])) { return i; }
	}
	return -1;
}

function getFiles(archiveFileName) {
	const result = trySpawnSync(sevenZipExes, [ "l", "-sccUTF-8", archiveFileName ], { stdio: "pipe" });
	if (result.error) { throw result.error; }
	if (result.status !== 0) { return []; }

	const stdout = result.stdout.toString("utf8");
	const lines = stdout.split(/\r?\n/);

	const index0 = getIndexOfMatch(lines, /^[ \-]{5,}$/, 0) - 1;
	if (index0 < 0) { return []; }

	const index1 = getIndexOfMatch(lines, /^[ \-]{5,}$/, index0 + 2);
	if (index1 < 0) { return []; }

	const match = /\bname\b\s*($)?/i.exec(lines[index0]);
	if (match === null) { return []; }

	const results = [];
	const start = match.index;
	const maxLength = match[0].length;
	const hasLength = match[1] !== undefined;
	for (let i = index0 + 2; i < index1; ++i) {
		const fileName = (hasLength ? lines[i].substr(start, maxLength).trimRight() : lines[i].substr(start));
		results.push(fileName);
	}
	return results;
}

function getFileContents(archiveFileName, fileName) {
	const result = trySpawnSync(sevenZipExes, [ "e", archiveFileName, fileName, "-so",  ], { stdio: "pipe" });
	if (result.error) { throw result.error; }
	return result.stdout;
}

function addInfoToArchive(archiveFileName, fileName, content) {
	const tempFileName = path.resolve(__dirname, fileName);
	fs.writeFileSync(tempFileName, content, { encoding: "utf8" });
	const result = trySpawnSync(sevenZipExes, [ "a", archiveFileName, tempFileName ], { stdio: "pipe" });
	if (result.error) { throw result.error; }
	if (result.status !== 0) { return false; }
	fs.unlinkSync(tempFileName);
	return true;
}


function parseCookieString(cookieString) {
	const re = /\s*([^=]*)=([^;]*)(?:;|$)/g;
	let match;
	const results = {};
	while ((match = re.exec(cookieString)) !== null) {
		results[match[1]] = match[2];
	}
	return results;
}

async function httpsGetAsync(url, jar) {
	return new Promise((resolve, reject) => {
		request.get({ url, jar, encoding: null }, (err, response, body) => {
			if (err) {
				reject(err);
			} else {
				resolve({ response, body });
			}
		});
	});
}

async function httpsPostJsonAsync(url, jsonData, jar) {
	return new Promise((resolve, reject) => {
		request.post({ url, jar, json: jsonData, encoding: null }, (err, response, body) => {
			if (err) {
				reject(err);
			} else {
				resolve({ response, body });
			}
		});
	});
}

function isSadpanda(response) {
	const cd = response.headers["content-disposition"];
	return (!!cd && cd.indexOf("filename=\"sadpanda.jpg\"") >= 0);
}

function getSearchResults(pageHtml) {
	const pattern = /<a\s+href="([^"]*)">\s*<div\s+class="glink">/ig;
	let match;
	const results = [];
	while ((match = pattern.exec(pageHtml)) !== null) {
		results.push(match[1]);
	}
	return results;
}

function getGalleryInfoFromUrl(urlString) {
	const parts = url.parse(urlString);
	const match = /^\/g\/(\d+)\/(\w+)\/?/.exec(parts.pathname);
	if (match === null) { return null; }
	return new GalleryIdentifier(parseInt(match[1], 10), match[2]);
}

function createCookieJar(exCookieString, site) {
	const jar = request.jar();
	if (typeof(exCookieString) === "string") {
		const cookies = parseCookieString(exCookieString);
		const requiredCookieNames = [ "ipb_member_id", "ipb_pass_hash", "igneous" ];
		for (const key in cookies) {
			if (requiredCookieNames.indexOf(key) < 0) { continue; }
			jar.setCookie(request.cookie(`${key}=${cookies[key]}`), `https://${site}/`);
		}
	}
	jar.setCookie("sl=dm_3", `https://${site}/`);
	return jar;
}

async function searchForImage(imageSource, site, jar) {
	const hash = crypto.createHash("sha1").update(imageSource).digest("hex");

	const urls = [
		`https://${site}/?f_shash=${hash}&fs_similar=0&fs_exp=0&fs_covers=1&f_cats=0`,
		`https://${site}/?f_shash=${hash}&fs_similar=0&fs_exp=1&fs_covers=1&f_cats=0`,
		`https://${site}/?f_shash=${hash}&fs_similar=0&fs_exp=0&fs_covers=0&f_cats=0`,
		`https://${site}/?f_shash=${hash}&fs_similar=0&fs_exp=1&fs_covers=0&f_cats=0`
	];

	for (const searchUrl of urls) {
		const data = await httpsGetAsync(searchUrl, jar);
		if (isSadpanda(data.response)) { break; }

		const galleryUrls = getSearchResults(data.body.toString("utf8"));
		if (galleryUrls.length > 0) { return { galleryUrls, searchUrl }; }
	}

	return { galleryUrls: [], searchUrl: urls[urls.length - 1] };
}


async function addMetadata(archiveFileName) {
	let files;
	try {
		files = getFiles(archiveFileName);
	} catch (e) {
		if (e.code === "ENOENT") {
			throw new Error("7z executable could not be found");
		}
		throw e;
	}

	const infoJsonFileName = "info.json";
	if (files.length === 0) {
		throw new Error("Invalid archive");
	}
	if (files.indexOf(infoJsonFileName) >= 0) {
		return `Archive already contains ${infoJsonFileName}`;
	}

	const imageIndex = getIndexOfMatch(files, /\.(jpe?g|gif|png|bmp)$/i, 0);
	if (imageIndex < 0) {
		throw new Error("Could not find image");
	}

	const imageSource = getFileContents(archiveFileName, files[imageIndex]);

	const useEx = (typeof(exCookieString) === "string");
	const site = (useEx ? "exhentai.org" : "e-hentai.org");
	const jar = createCookieJar(exCookieString, site);

	const {galleryUrls, searchUrl} = await searchForImage(imageSource, site, jar);

	let galleryInfo = null;
	for (const galleryUrl of galleryUrls) {
		galleryInfo = getGalleryInfoFromUrl(galleryUrl);
		if (galleryInfo !== null) { break; }
	}
	if (galleryInfo === null) {
		throw new Error(`No results (${searchUrl})`);
	}

	const data = {
		method: "gdata",
		gidlist: [ [ galleryInfo.id, galleryInfo.token ] ],
		namespace: 1
	};

	const postResult = await httpsPostJsonAsync(`https://${site}/api.php`, data, jar);
	const json = postResult.body.gmetadata[0];

	if (json.error) {
		throw new Error(json.error);
	}

	const info = getFromJson(json, `https://${site}/`);
	const cJson = commonJson.toCommonJson(info);

	if (!addInfoToArchive(archiveFileName, infoJsonFileName, JSON.stringify(cJson, null, "  "))) {
		throw new Error(`Failed to add ${infoJsonFileName} to archive`);
	}

	return `Successfully added ${infoJsonFileName}`;
}


async function main() {
	const input = process.argv[2];
	if (!input) {
		process.stderr.write("Archive file required as first argument\n");
		return -2;
	}

	try {
		const status = await addMetadata(input);
		process.stdout.write(`${status}\n`);
		return 0;
	} catch (e) {
		console.error(e);
		return -1;
	}
}

if (require.main === module) {
	(async () => { process.exit(await main()); })();
}
