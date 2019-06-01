"use strict";

const fs = require("fs");
const path = require("path");


function isObject(value) {
	return (value !== null && typeof(value) === "object" && !Array.isArray(value));
}

function hasPrefix(text, prefix) {
	return (text.length >= prefix.length && text.substr(0, prefix.length) === prefix);
}

function escapeRegexString(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceObjectGroups(text, objectMapping, transform) {
	if (!isObject(objectMapping)) { return text; }

	return text.replace(/\$\{([^\}]*)\}/g, (m0, m1) => {
		if (!Object.prototype.hasOwnProperty.call(objectMapping, m1)) { return m0; }
		m1 = objectMapping[m1];
		if (typeof(transform) === "function") { m1 = transform(m1); }
		return m1;
	});
}


function matchesRegex(text, caseSensitive, matchText, objectMapping) {
	matchText = replaceObjectGroups(matchText, objectMapping, escapeRegexString);
	let regex;
	try {
		regex = new RegExp(matchText, caseSensitive ? "": "i");
	} catch (e) {
		return false;
	}
	return regex.test(text);
}

function matchesText(text, caseSensitive, matchText, objectMapping) {
	matchText = replaceObjectGroups(matchText, objectMapping, null);
	if (text.length !== matchText.length) {
		return false;
	}
	if (!caseSensitive) {
		text = text.toLowerCase();
		matchText = matchText.toLowerCase();
	}
	return (text === matchText);
}

function matches(text, caseSensitive, matchText, objectMapping) {
	const prefix = "regex:";
	return (hasPrefix(matchText, prefix) ?
		matchesRegex(text, caseSensitive, matchText.substr(prefix.length), objectMapping) :
		matchesText(text, caseSensitive, matchText, objectMapping));
}

function matchesList(text, caseSensitive, matchTextList, objectMapping) {
	for (const matchText of matchTextList) {
		if (matches(text, caseSensitive, matchText, objectMapping)) {
			return true;
		}
	}
	return false;
}

function anyMatches(textList, caseSensitive, matchText, objectMapping) {
	for (const text of textList) {
		if (matches(text, caseSensitive, matchText, objectMapping)) {
			return true;
		}
	}
	return false;
}

function anyMatchesList(textList, caseSensitive, matchTextList, objectMapping) {
	for (const text of textList) {
		if (matchesList(text, caseSensitive, matchTextList, objectMapping)) {
			return true;
		}
	}
	return false;
}


function removeExtension(fileName) {
	const ext = path.extname(fileName);
	return ext ? fileName.substr(0, fileName.length - ext.length) : fileName;
}

function fileHasExtension(fileName, extensions) {
	const fileExt = (path.extname(fileName) || "");
	return matchesList(fileExt, false, extensions);
}


function getFilesAndDirectories(directory) {
	let fileNames;
	try {
		fileNames = fs.readdirSync(directory);
	} catch (e) {
		fileNames = [];
	}

	const files = [];
	const directories = [];

	for (const fileName of fileNames) {
		const fullFileName = path.resolve(directory, fileName);

		let info;
		try {
			info = fs.lstatSync(fullFileName);
		} catch (e) {
			continue;
		}

		if (info.isDirectory()) {
			directories.push(fullFileName);
		} else if (info.isFile()) {
			files.push(fullFileName);
		}
	}

	return { files, directories };
}

function getMatchingFile(files, matchTextList, objectMapping) {
	for (const file of files) {
		if (matchesList(file, false, matchTextList, objectMapping)) {
			return file;
		}
	}
	return null;
}


function sortFindIndex(array, callback) {
	const ii = array.length;
	if (ii === 0) { return -1; }

	let index = 0;
	let compareValue = callback(array[index]);

	for (let i = 1; i < ii; ++i) {
		const cv = callback(array[i]);
		if (cv < compareValue) {
			index = i;
			compareValue = cv;
		}
	}

	return index;
}


function writeBufferToFile(path, content) {
	fs.writeFileSync(path, content, { encoding: null });
}


module.exports = {
	isObject,
	removeExtension,
	fileHasExtension,
	getFilesAndDirectories,
	getMatchingFile,
	replaceObjectGroups,
	matches,
	matchesList,
	anyMatches,
	anyMatchesList,
	sortFindIndex,
	writeBufferToFile
};
