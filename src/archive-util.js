"use strict";

const cp = require("child_process");

const sevenZipExes = [ "7z" ];
const maxBuffer = 1024 * 1024 * 1024; // 1 GiB


function trySpawnSync(executables, args, options) {
	let result = null;
	const errors = [];
	for (const exe of executables) {
		result = cp.spawnSync(exe, args, options);
		if (!result.error) { return result; }
		errors.push(result.error);
	}

	if (result === null) { return result; }

	const nonEnoentErrors = errors.filter((r) => r.code !== "ENOENT");
	if (nonEnoentErrors.length === 0) {
		result.error = new Error("Failed to find 7zip executable");
	} else {
		result.error = nonEnoentErrors[nonEnoentErrors.length - 1];
		for (const e of nonEnoentErrors) {
			if (e.code === "ENOBUFS") {
				result.error = new Error("Buffer size exceeded");
				break;
			}
		}
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
	const result = trySpawnSync(sevenZipExes, [ "l", "-sccUTF-8", archiveFileName ], { stdio: "pipe", maxBuffer });
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
	const result = trySpawnSync(sevenZipExes, [ "e", "-so" , archiveFileName, fileName], { stdio: "pipe", maxBuffer });
	if (result.error) { throw result.error; }
	return result.stdout;
}

function addFile(archiveFileName, fileName, content) {
	const result = trySpawnSync(sevenZipExes, [ "a", archiveFileName, `-si${fileName}` ], { stdio: "pipe", input: content, maxBuffer });
	if (result.error) { throw result.error; }
	if (result.status !== 0) { return false; }
	return true;
}

function setSevenZipExes(exeList) {
	if (Array.isArray(exeList)) {
		sevenZipExes.length = 0;
		for (const exe of exeList) {
			sevenZipExes.push(exe);
		}
	}
}


module.exports = {
	getFiles,
	getFileContents,
	addFile,
	setSevenZipExes
};
