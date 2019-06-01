"use strict";

const path = require("path");
const util = require("./util");
const archiveUtil = require("./archive-util");
const Archive = require("./archive").Archive;


class ArchiveFile extends Archive {
	constructor(fileName) {
		super(
			fileName,
			null,
			"file",
			path.dirname(fileName),
			util.removeExtension(path.basename(fileName)));
	}

	get files() {
		const f = super.files;
		if (f !== null) { return f; }

		super.files = archiveUtil.getFiles(this.fileName);
		return super.files;
	}

	findExistingFileInArchive(matchTextList) {
		return this.getMatchingFile(this.files, matchTextList);
	}

	findExistingFileInFolder(matchTextList) {
		if (!Array.isArray(matchTextList)) { return null; }
		const files = util.getFilesAndDirectories(this.dirName).files.map((f) => path.basename(f));
		return this.getMatchingFile(files, matchTextList);
	}

	findExistingFileInParentFolder(matchTextList) {
		if (!Array.isArray(matchTextList)) { return null; }
		const files = util.getFilesAndDirectories(path.dirname(this.dirName)).files.map((f) => path.basename(f));
		return this.getMatchingFile(files, matchTextList);
	}

	readFile(fileName) {
		return archiveUtil.getFileContents(this.fileName, fileName);
	}

	writeFile(fileName, content) {
		archiveUtil.addFile(this.fileName, fileName, content);
	}
}


module.exports = {
	ArchiveFile
};
