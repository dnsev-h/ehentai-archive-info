"use strict";

const util = require("./util");


class Archive {
	constructor(fileName, files, partial, type, dirName, name) {
		if (files !== null && !Array.isArray(files)) { throw new TypeError("Invalid value for files"); }

		this._fileName = fileName;
		this._files = files;
		this._partial = partial;
		this._type = type;
		this._dirName = dirName;
		this._name = name;
		this._matchVariables = { name };
	}

	get fileName() {
		return this._fileName;
	}

	get type() {
		return this._type;
	}

	get name() {
		return this._name;
	}

	get dirName() {
		return this._dirName;
	}

	get files() {
		return this._files;
	}
	set files(value) {
		if (!Array.isArray(value)) { throw new TypeError("Invalid value"); }
		this._files = value;
	}

	get partial() {
		return this._partial;
	}
	set partial(value) {
		this._partial = value;
	}


	defineVariable(key, value) {
		this._matchVariables[key] = value;
	}

	getMatchingFile(files, matchTextList) {
		if (!Array.isArray(matchTextList)) { return null; }
		return util.getMatchingFile(files, matchTextList, this._matchVariables);
	}

	getFileNameFormat(format) {
		return typeof(format) === "string" ? util.replaceObjectGroups(format, this._matchVariables, null) : format;
	}


	findExistingFileInArchive(matchTextList) {
		throw new Error("Not implemented");
	}

	findExistingFileInFolder(matchTextList) {
		throw new Error("Not implemented");
	}

	findExistingFileInParentFolder(matchTextList) {
		throw new Error("Not implemented");
	}

	readFile(fileName) {
		throw new Error("Not implemented");
	}

	writeFile(fileName, content) {
		throw new Error("Not implemented");
	}
}


module.exports = {
	Archive
};
