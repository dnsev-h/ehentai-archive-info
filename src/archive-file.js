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
			true,
			"file",
			path.dirname(fileName),
			util.removeExtension(path.basename(fileName)));
	}

	get files() {
		const f = super.files;
		if (f !== null) { return f; }

		super.files = archiveUtil.getFiles(this.fileName);
		super.partial = false;
		return super.files;
	}

	findExistingFileInArchive(matchTextList) {
		const fileName = this.getMatchingFile(this.files, matchTextList);
		return fileName !== null ? { fileName, type: "archive" } : null;
	}

	findExistingFileInFolder(matchTextList) {
		let fileName = null;
		if (Array.isArray(matchTextList)) {
			const files = util.getFilesAndDirectories(this.dirName).files.map((f) => path.basename(f));
			fileName = this.getMatchingFile(files, matchTextList);
		}
		return fileName !== null ? { fileName, type: "folder" } : null;
	}

	findExistingFileInParentFolder(matchTextList) {
		let fileName = null;
		if (Array.isArray(matchTextList)) {
			const files = util.getFilesAndDirectories(path.dirname(this.dirName)).files.map((f) => path.basename(f));
			fileName = this.getMatchingFile(files, matchTextList);
		}
		return fileName !== null ? { fileName, type: "folder-parent" } : null;
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
