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
		if (!Array.isArray(matchTextList)) { return null; }
		const files = util.getFilesAndDirectories(this.fileName).files.map((f) => path.basename(f));
		return this.getMatchingFile(files, matchTextList);
	}

	findExistingFileInParentFolder(matchTextList) {
		if (!Array.isArray(matchTextList)) { return null; }
		const files = util.getFilesAndDirectories(path.dirname(this.fileName)).files.map((f) => path.basename(f));
		return this.getMatchingFile(files, matchTextList);
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
