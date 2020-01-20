"use strict";

const fs = require("fs");
const path = require("path");
const util = require("./util");
const Archive = require("./archive").Archive;


class ArchiveFolder extends Archive {
	constructor(fileName, files, partial) {
		super(
			fileName,
			files,
			partial,
			"folder",
			fileName,
			path.basename(fileName));
	}

	findExistingFileInArchive() {
		return null;
	}

	findExistingFileInFolder(matchTextList) {
		let fileName = null;
		if (Array.isArray(matchTextList)) {
			const files = util.getFilesAndDirectories(this.fileName).files.map((f) => path.basename(f));
			fileName = this.getMatchingFile(files, matchTextList);
		}
		return fileName !== null ? { fileName, type: "folder" } : null;
	}

	findExistingFileInParentFolder(matchTextList) {
		let fileName = null;
		if (Array.isArray(matchTextList)) {
			const files = util.getFilesAndDirectories(path.dirname(this.fileName)).files.map((f) => path.basename(f));
			fileName = this.getMatchingFile(files, matchTextList);
		}
		return fileName !== null ? { fileName, type: "folder-parent" } : null;
	}

	readFile(fileName) {
		return fs.readFileSync(path.resolve(this.fileName, fileName), { encoding: null });
	}

	writeFile(fileName, content) {
		util.writeBufferToFile(path.resolve(this.fileName, fileName), content);
	}
}


module.exports = {
	ArchiveFolder
};
