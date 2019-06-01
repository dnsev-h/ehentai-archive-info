"use strict";

const url = require("url");
const crypto = require("crypto");
const GalleryIdentifier = require("./gallery-identifier").GalleryIdentifier;
const getFromJson = require("./gallery-info/get-from-json");
const request = require("../request");

const maxApiResults = 25;


function isSadpanda(response) {
	const cd = response.headers["content-disposition"];
	return (!!cd && cd.indexOf("filename=\"sadpanda.jpg\"") >= 0);
}

function getGalleryInfoFromUrl(urlString) {
	const parts = url.parse(urlString);
	const match = /^\/g\/(\d+)\/(\w+)\/?/.exec(parts.pathname);
	if (match === null) { return null; }
	return new GalleryIdentifier(parseInt(match[1], 10), match[2]);
}

function getSearchResultsFromHtml(pageHtml) {
	const pattern = /<a\s+href="([^"]*)">\s*<div\s+class="glink">/ig;
	let match;
	const results = [];
	while ((match = pattern.exec(pageHtml)) !== null) {
		const info = getGalleryInfoFromUrl(match[1]);
		if (info === null) { continue; }
		results.push(info);
	}
	return results;
}


function getImageHash(imageSource) {
	return crypto.createHash("sha1").update(imageSource).digest("hex");
}


function getImageHashSearchUrl(site, imageHash, searchCoversOnly, searchExpunged) {
	return `${site}/?f_shash=${imageHash}&fs_similar=0&fs_exp=${searchExpunged ? 1 : 0}&fs_covers=${searchCoversOnly ? 1 : 0}&f_cats=0`;
}

async function getSearchResults(searchUrl, cookieJar) {
	const data = await request.get(searchUrl, cookieJar);
	if (isSadpanda(data.response)) {
		throw new Error("Sad panda");
	}

	return getSearchResultsFromHtml(data.body.toString("utf8"));
}


function getGalleryInfoFromApiResponse(array, index, site) {
	if (index >= array.length) {
		return { error: `Invalid response[${index}]: out of bounds`, info: null };
	}

	const arrayEntry = array[index];
	if (!(arrayEntry !== null && typeof(arrayEntry) === "object" && !Array.isArray(arrayEntry))) {
		return { error: `Invalid response[${index}]: ${typeof(arrayEntry)}`, info: null };
	}
	if (arrayEntry.error) {
		return { error: arrayEntry.error, info: null };
	}
	return { error: null, info: getFromJson(arrayEntry, site) };
}

function getResponseJson(responseBody) {
	if (!(responseBody instanceof Buffer)) { return responseBody; }

	let responseJson;
	try {
		responseJson = JSON.parse(responseBody);
	} catch (e) {
		throw new Error("Invalid response JSON");
	}

	if (responseJson === null || typeof(responseJson) !== "object" || Array.isArray(responseJson)) {
		throw new Error("Unexpected response");
	}

	return responseJson;
}

async function getGalleryInfos(site, cookieJar, galleryIdentifiers) {
	const gidlist = [];
	for (const id of galleryIdentifiers) {
		gidlist.push([ id.id, id.token ]);
	}

	const requestJson = {
		method: "gdata",
		gidlist,
		namespace: 1
	};

	const response = await request.postJson(`${site}/api.php`, cookieJar, requestJson);
	const responseJson = getResponseJson(response.body);
	const jsonArray = responseJson.gmetadata;
	if (!Array.isArray(jsonArray)) {
		throw new Error("Unexpected response array");
	}

	const results = [];
	for (let i = 0, ii = galleryIdentifiers.length; i < ii; ++i) {
		results.push(getGalleryInfoFromApiResponse(jsonArray, i, site));
	}
	return results;
}


module.exports = {
	getImageHash,
	getImageHashSearchUrl,
	getSearchResults,
	getGalleryInfos,
	get maxApiResults() { return maxApiResults; }
};
