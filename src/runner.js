"use strict";

const fs = require("fs");
const path = require("path");
const util = require("./util");
const archive = require("./archive-util");
const request = require("./request");
const ArchiveFile = require("./archive-file").ArchiveFile;
const ArchiveFolder = require("./archive-folder").ArchiveFolder;
const commonJson = require("./api/gallery-info/common-json");
const lookup = require("./api/lookup");


class Runner {
	constructor(log, config, configDir) {
		this.log = log;
		this.config = config;
		this.configDir = configDir;

		this.site = null;
		this.useEx = false;
		this.cookieJar = null;

		this.delays = {};
	}


	async run(fileNames) {
		let logCount = this.log.counts.total;
		const result = await this.runInternal(fileNames);

		const skipOnCompletion = safeGet(() => this.config.lookup.delay.skipOnCompletion, false);
		if (!skipOnCompletion) {
			const delays = this.getIncompleteDelays();
			if (delays.length > 0) {
				const logCountNew = this.log.counts.total;
				if (logCountNew > logCount) {
					this.log.info("");
					logCount = logCountNew;
				}

				this.log.info("Waiting for all delays to complete...");

				try {
					await this.waitForAllDelays(delays);
				} catch (e) {
					this.log.error(e);
				}
			}
		}

		return result;
	}

	async runInternal(fileNames) {
		try {
			let logCount = this.log.counts.total;
			this.initDependencies();
			this.initCookies();

			const targets = [];
			for (const fileName of fileNames) {
				this.getTargetsFromFileName(fileName, targets);
			}

			for (const target of targets) {
				const logCountNew = this.log.counts.total;
				if (logCountNew > logCount) {
					this.log.info("");
					logCount = logCountNew;
				}

				this.log.info(`Processing ${target.type}: ${target.fileName}...`);
				await this.process(target);
			}
			return 0;
		} catch (e) {
			this.log.error(e);
			return 1;
		}
	}


	async process(target) {
		const archiveConfig = safeGet(() => this.config.archive[target.type], null);
		if (!util.isObject(archiveConfig)) {
			this.log.error(`Invalid archive type: ${target.type}`);
			return;
		}

		// Skip?
		if (this.shouldSkipTarget(target, archiveConfig)) { return; }

		// Get images
		const images = this.getOrderedTargetImages(target, archiveConfig);

		// Get counted search results
		let results = await this.getSearchResults(target, images, archiveConfig);
		if (results.length === 0) {
			this.log.error("Failed to find any results");
			return;
		}

		this.log.info(`Found ${results.length} results`);
		for (const result of results) {
			this.log.debug(this.createGalleryUrl(result.id), `matches=${result.count}`);
		}

		// Get metadata for search results
		results = await this.getSearchResultsInfo(results);
		results = results.filter((v) => v.info !== null);

		if (results.length === 0) {
			this.log.error("Failed get info for results");
			return;
		}

		// Update priorities and filter
		this.updatePriorities(results, images.length, target.partial);

		for (const result of results) {
			this.log.debug(`${this.createGalleryUrl(result.id)} info: priority=${result.priority.total}; blacklist=${result.priority.blacklist}`);
		}

		results = results.filter((v) => !v.priority.blacklist);

		if (results.length === 0) {
			this.log.error("All results were filtered out");
			return;
		}

		// Sort and get the best result
		results.sort((a, b) => b.priority.total - a.priority.total);
		const best = results[0];
		this.addInfoToArchive(target, archiveConfig, best.info);
	}

	shouldSkipTarget(target, archiveConfig) {
		let file = target.findExistingFileInArchive(archiveConfig.skipIfFileExistsInArchiveFile);
		if (file !== null) {
			this.log.info(`Skipped because ${file} already exists inside archive`);
			return true;
		}

		file = target.findExistingFileInFolder(archiveConfig.skipIfFileExistsInFolder);
		if (file !== null) {
			this.log.info(`Skipped because ${file} already exists inside folder`);
			return true;
		}

		file = target.findExistingFileInParentFolder(archiveConfig.skipIfFileExistsInParentFolder);
		if (file !== null) {
			this.log.info(`Skipped because ${file} already exists inside parent folder`);
			return true;
		}

		return false;
	}

	getOrderedTargetImages(target, archiveConfig) {
		const imageFileExtensions = getArray(safeGet(() => this.config.scanning.imageFileExtensions, []));
		const images = target.files.filter((f) => util.fileHasExtension(f, imageFileExtensions));
		return getFilteredImageList(images, archiveConfig.preferredImageOrder);
	}

	addInfoToArchive(target, archiveConfig, info) {
		const json = commonJson.toCommonJson(info);
		const jsonString = JSON.stringify(json, null, "  ");
		const infoJsonContent = Buffer.from(jsonString, "utf8");

		let fileName = safeGet(() => target.getFileNameFormat(archiveConfig.metadataFileNameInArchiveFile), null);
		const success = this.tryWriteInfoFile(target, null, fileName, infoJsonContent);

		if (!success) {
			fileName = safeGet(() => target.getFileNameFormat(archiveConfig.metadataFileNameInFolderOnFailure), null);
			this.tryWriteInfoFile(target, target.dirName, fileName, infoJsonContent);
		}

		fileName = safeGet(() => target.getFileNameFormat(archiveConfig.metadataFileNameInFolder), null);
		this.tryWriteInfoFile(target, target.dirName, fileName, infoJsonContent);

		fileName = safeGet(() => target.getFileNameFormat(archiveConfig.metadataFileNameInParentFolder), null);
		this.tryWriteInfoFile(target, path.dirname(target.dirName), fileName, infoJsonContent);
	}

	tryWriteInfoFile(target, directory, fileName, content) {
		if (typeof(fileName) !== "string") { return true; }

		let displayFileName;
		let extra;
		fileName = target.getFileNameFormat(fileName);
		if (directory !== null) {
			fileName = path.resolve(directory, fileName);
			displayFileName = path.relative(target.dirName, fileName);
			extra = "";
		} else {
			displayFileName = fileName;
			extra = " to archive";
		}

		try {
			if (directory === null) {
				target.writeFile(fileName, content);
			} else {
				util.writeBufferToFile(fileName, content);
			}
		} catch (e) {
			this.log.error(`Failed to add metadata${extra}: ${displayFileName}`, e);
			return false;
		}

		this.log.info(`Successfully added metadata${extra}: ${displayFileName}`);
		return true;
	}


	async getSearchResults(target, images, archiveConfig) {
		const searchDelay = getNumber(this.config.lookup.delay.gallerySearch, 1.0);
		const minImagesToCheck = Math.max(1, getInteger(archiveConfig.minImagesToCheck, 1));
		const maxImagesToCheck = Math.max(1, getInteger(archiveConfig.maxImagesToCheck, 1));
		const maxSearchErrors = Math.max(1, getInteger(archiveConfig.maxSearchErrors, 1));
		const continueSearchIfResultsAreAmbiguous = !!archiveConfig.continueSearchIfResultsAreAmbiguous;
		let checkCount = 0;
		let checkCountWithResults = 0;
		let errorCount = 0;
		const searchResults = [];
		const imageCount = images.length;

		for (let i = 0; i < imageCount; ++i) {
			// Exit conditions
			if (checkCount >= maxImagesToCheck) { break; }
			if (checkCountWithResults >= minImagesToCheck && searchResults.length > 0) {
				if (continueSearchIfResultsAreAmbiguous && this.areSearchResultsAmbiguous(searchResults)) {
					this.log.debug("Continuing search because results are ambiguous");
				} else {
					break;
				}
			}

			// Get image source
			const imageFileName = images[i];
			let imageSource;
			try {
				imageSource = target.readFile(imageFileName);
			} catch (e) {
				this.log.error(`Failed to read image: ${imageFileName}`, e);
				continue;
			}

			// Get hash
			const imageHash = lookup.getImageHash(imageSource);

			// Lookup
			let results;
			try {
				results = await this.searchForGalleriesWithImage(checkCount, imageHash, searchDelay);
			} catch (e) {
				this.log.error(`Failed to look up image: ${imageFileName}`, e);
				if (++errorCount >= maxSearchErrors) { break; }
				continue;
			} finally {
				++checkCount;
			}

			if (results.length === 0) {
				this.log.info(`No results found for: ${imageFileName}`);
				continue;
			}

			// Add results
			++checkCountWithResults;

			for (const id of results) {
				const index = searchResults.findIndex((e) => (e.id.id === id.id && e.id.token === id.token));
				let result;
				if (index >= 0) {
					result = searchResults[index];
				} else {
					result = { id, count: 0 };
					searchResults.push(result);
				}
				++result.count;
			}
		}

		return searchResults;
	}

	areSearchResultsAmbiguous(results) {
		const ii = results.length;
		if (ii === 0) { return true; }
		if (ii > 1) {
			let maxCount = 0;
			for (let i = 0; i < ii; ++i) {
				maxCount = Math.max(maxCount, results[i].count);
			}

			let resultsWithMaxCount = 0;
			for (let i = 0; i < ii; ++i) {
				if (results[i].count === maxCount && ++resultsWithMaxCount > 1) {
					return true;
				}
			}
		}
		return false;
	}

	async searchForGalleriesWithImage(imageIndex, imageHash, delay) {
		const delayName = "search";

		const searchExpunged = !!safeGet(() => this.config.lookup.searchExpunged, false);
		const searchCoversOnly = (!!safeGet(() => this.config.lookup.searchCoversOnly, false)) && (imageIndex === 0);

		const urls = [];
		if (searchCoversOnly) { urls.push(lookup.getImageHashSearchUrl(this.site, imageHash, true, false)); }
		urls.push(lookup.getImageHashSearchUrl(this.site, imageHash, false, false));
		if (searchExpunged) {
			if (searchCoversOnly) { urls.push(lookup.getImageHashSearchUrl(this.site, imageHash, true, true)); }
			urls.push(lookup.getImageHashSearchUrl(this.site, imageHash, false, true));
		}

		let results = null;
		for (const url of urls) {
			this.log.debug(`Searching image ${imageIndex + 1}`, url);

			await this.waitForDelay(delayName);
			results = await lookup.getSearchResults(url, this.cookieJar);
			this.setDelay(delayName, delay);

			if (results.length > 0) { break; }
		}
		return results;
	}

	async getSearchResultsInfo(searchResults) {
		const delayName = "api";
		const searchDelay = getNumber(this.config.lookup.delay.apiCall, 5.0);

		const maximumNumberOfResultsToCheck = Math.max(1, getInteger(safeGet(() => this.config.lookup.maximumNumberOfResultsToCheck, 1), 1));

		searchResults = searchResults
			.map((value, index) => ({ id: value.id, count: value.count, index, info: null }))
			.sort((a, b) => {
				const i = b.count - a.count;
				return (i !== 0) ? i : a.index - b.index;
			})
			.slice(0, maximumNumberOfResultsToCheck);

		const maxApiResults = lookup.maxApiResults;
		for (let i = 0, ii = searchResults.length; i < ii; i += maxApiResults) {
			const galleryIdentifiers = searchResults
				.slice(i, maxApiResults)
				.map((v) => v.id);

			await this.waitForDelay(delayName);
			const galleryInfos = await lookup.getGalleryInfos(this.site, this.cookieJar, galleryIdentifiers);
			this.setDelay(delayName, searchDelay);
			for (let j = 0, jj = galleryInfos.length; j < jj; ++j) {
				const info = galleryInfos[j];
				if (info.error) {
					this.log.error(info.error);
				} else {
					searchResults[i + j].info = info.info;
				}
			}
		}

		return searchResults;
	}


	updatePriorities(results, imageCount, isPartial) {
		// Priority for all
		const tagPriorities = safeGet(() => this.config.lookup.priorities.tags, null);
		const languagePriorities = safeGet(() => this.config.lookup.priorities.language, null);
		const titlePriorities = safeGet(() => this.config.lookup.priorities.title, null);
		const titleOriginalPriorities = safeGet(() => this.config.lookup.priorities.titleOriginal, null);

		for (const result of results) {
			const priority = { total: 0.0, positive: 0.0, negative: 0.0, blacklist: false };

			if (Array.isArray(tagPriorities)) {
				this.updatePrioritiesForTags(priority, result.info, tagPriorities);
			}

			this.updatePrioritiesForGenericField(priority, result.info, "language", languagePriorities);
			this.updatePrioritiesForGenericField(priority, result.info, "title", titlePriorities);
			this.updatePrioritiesForGenericField(priority, result.info, "titleOriginal", titleOriginalPriorities);

			result.priority = priority;
		}

		// Priority for best
		if (!isPartial) {
			this.updatePriorityForBest(
				results,
				() => this.config.lookup.priorities.fileCount.nearest,
				(result) => Math.abs(imageCount - result.info.fileCount));
		}

		this.updatePriorityForBest(
			results,
			() => this.config.lookup.priorities.fileCount.highest,
			(result) => -result.info.fileCount);

		this.updatePriorityForBest(
			results,
			() => this.config.lookup.priorities.fileCount.highestSearchMatches,
			(result) => -result.count);
	}

	updatePrioritiesForTags(value, info, tagPriorities) {
		let any = false;
		const defaults = [];

		for (const tagPriority of tagPriorities) {
			if (!util.isObject(tagPriority)) { continue; }
			if (tagPriority.value === null) { defaults.push(tagPriority); }
			if (typeof(tagPriority.value) !== "string") { continue; }

			const {tag, namespace} = getTagAndNamespace(tagPriority.value);
			if (namespace) {
				const infoTags = info.tags[namespace];
				if (Array.isArray(infoTags) && util.anyMatches(infoTags, false, tag)) {
					applyPriority(value, tagPriority);
					any = true;
				}
			} else {
				for (const infoTags of info.tags) {
					if (util.anyMatches(infoTags, false, tag)) {
						applyPriority(value, tagPriority);
						any = true;
					}
				}
			}
		}

		if (!any) {
			for (const d of defaults) {
				applyPriority(value, d);
			}
		}
	}

	updatePrioritiesForGenericField(value, info, infoField, priorityEntries) {
		if (!Array.isArray(priorityEntries)) { return; }

		let any = false;
		const defaults = [];

		for (const priorityEntry of priorityEntries) {
			if (!util.isObject(priorityEntry)) { continue; }
			if (priorityEntry.value === null) { defaults.push(priorityEntry); }
			if (typeof(priorityEntry.value) !== "string") { continue; }

			const field = info[infoField];
			if (typeof(field) === "string" && util.matches(field, false, priorityEntry.value)) {
				applyPriority(value, priorityEntry);
				any = true;
			}
		}

		if (!any) {
			for (const d of defaults) {
				applyPriority(value, d);
			}
		}
	}

	updatePriorityForBest(results, get, sortBest) {
		const priorityInfo = safeGet(get, null);
		if (!util.isObject(priorityInfo)) { return; }

		const index = util.sortFindIndex(results, sortBest);
		if (index < 0) { return; }

		const v = sortBest(results[index]);
		for (const result of results) {
			if (sortBest(result) === v) {
				applyPriority(result.priority, priorityInfo);
			}
		}
	}


	setDelay(name, time) {
		if (time <= 0) { return; }

		const p = new Promise((resolve) => {
			setTimeout(() => {
				if (this.delays[name] === p) { this.delays[name] = null; }
				resolve();
			}, time * 1000);
		});
		this.delays[name] = p;
	}

	async waitForDelay(name) {
		if (this.delays.hasOwnProperty(name)) {
			const delay = this.delays[name];
			if (delay !== null) {
				await delay;
			}
		}
	}

	getIncompleteDelays() {
		const names = [];
		for (const name in this.delays) {
			if (!Object.prototype.hasOwnProperty.call(this.delays, name)) { continue; }
			const delay = this.delays[name];
			if (delay !== null) { names.push(name); }
		}
		return names;
	}

	async waitForAllDelays(names) {
		for (const name of names) {
			await this.waitForDelay(name);
		}
	}


	getTargetsFromFileName(fileName, targets) {
		let info;
		try {
			info = fs.lstatSync(fileName);
		} catch (e) {
			this.log.error(`Invalid file: ${fileName}`);
			this.log.debug(e);
			return;
		}

		if (info.isDirectory()) {
			this.getTargetsInDirectory(fileName, targets);
			return;
		}

		if (info.isFile()) {
			const imageFileExtensions = getArray(safeGet(() => this.config.scanning.imageFileExtensions, []));
			const archiveFileExtensions = getArray(safeGet(() => this.config.scanning.archiveFileExtensions, []));
			if (util.fileHasExtension(fileName, archiveFileExtensions)) {
				targets.push(new ArchiveFile(fileName));
			}
			else if (util.fileHasExtension(fileName, imageFileExtensions)) {
				targets.push(new ArchiveFolder(path.dirname(fileName), [ fileName ], true));
			}
		}
	}

	getTargetsInDirectory(fileName, targets) {
		const scanFoldersForArchives = !!safeGet(() => this.config.scanning.scanFoldersForArchives, false);
		const scanFoldersForImages = !!safeGet(() => this.config.scanning.scanFoldersForImages, false);
		const ignoreFiles = getArray(safeGet(() => this.config.scanning.ignoreFiles, []));
		const ignoreDirectories = getArray(safeGet(() => this.config.scanning.ignoreDirectories, []));
		const scanFoldersRecursiveDepth = getInteger(safeGet(() => this.config.scanning.scanFoldersRecursiveDepth, 1));
		const archiveFolderPermitNestedDirectores = !!safeGet(() => this.config.scanning.archiveFolderPermitNestedDirectores, false);
		const archiveFileExtensions = getArray(safeGet(() => this.config.scanning.archiveFileExtensions, []));
		const imageFileExtensions = getArray(safeGet(() => this.config.scanning.imageFileExtensions, []));
		const archiveFolderPermittedExtensions = getArray(safeGet(() => this.config.scanning.archiveFolderPermittedExtensions, []));

		const scanDirectories = [{ fileName, depth: 0 }];

		while (scanDirectories.length > 0) {
			const info = scanDirectories.shift();
			if (info.depth >= scanFoldersRecursiveDepth) { continue; }

			let {files, directories} = util.getFilesAndDirectories(info.fileName);
			files = files.filter((v) => !util.matchesList(path.basename(v), false, ignoreFiles));
			directories = directories.filter((v) => !util.matchesList(path.basename(v), false, ignoreDirectories));

			const archiveFiles = [];
			const archiveImages = [];

			for (const file of files) {
				if (scanFoldersForArchives && util.fileHasExtension(file, archiveFileExtensions)) {
					targets.push(new ArchiveFile(file));
				}

				if (util.fileHasExtension(file, imageFileExtensions)) {
					archiveFiles.push(file);
					archiveImages.push(file);
				} else if (util.fileHasExtension(file, archiveFolderPermittedExtensions)) {
					archiveFiles.push(file);
				}
			}

			const isArchiveFolder = (archiveImages.length > 0 && archiveFiles.length === files.length && scanFoldersForImages);
			if (isArchiveFolder) {
				targets.push(new ArchiveFolder(info.fileName, archiveFiles.map((f) => path.relative(info.fileName, f)), false));
			}

			if (!isArchiveFolder || archiveFolderPermitNestedDirectores) {
				const nextDepth = info.depth + 1;
				for (const directory of directories) {
					scanDirectories.push({ fileName: directory, depth: nextDepth });
				}
			}
		}
	}


	createGalleryUrl(identifier) {
		return `${this.site}/g/${identifier.id}/${identifier.token}/`;
	}


	initDependencies() {
		const exes = safeGet(() => this.config.general.sevenZipExeSearchLocations);
		if (Array.isArray(exes)) {
			archive.setSevenZipExes(exes);
		}
	}

	initCookies() {
		// Setup
		const exCookieString = this.readCookieString();

		this.useEx = (exCookieString !== null);
		this.site = (this.useEx ? "https://exhentai.org" : "https://e-hentai.org");
		this.cookieJar = request.jar();

		// Authentication cookies
		if (this.useEx) {
			const cookies = parseCookieString(exCookieString);
			const requiredCookieNames = [ "ipb_member_id", "ipb_pass_hash", "igneous" ];
			for (const key in cookies) {
				if (!Object.prototype.hasOwnProperty.call(cookies, key)) { continue; }
				if (requiredCookieNames.indexOf(key) < 0) { continue; }
				this.cookieJar.setCookie(request.cookie(`${key}=${cookies[key]}`), this.site);
			}
		}

		// Layout cookies
		this.cookieJar.setCookie(request.cookie("sl=dm_3"), this.site);
	}

	readCookieString() {
		try {
			const exCookieFileName = safeGet(() => this.config.lookup.exCookiesFileName);
			if (typeof(exCookieFileName) === "string") {
				const exCookieFileNameFull = path.resolve(this.configDir, exCookieFileName);
				try {
					return fs.readFileSync(exCookieFileNameFull, { encoding: "utf8" }).trim() || null;
				} catch (e) {
					this.log.info(`Failed to read cookie file: ${exCookieFileName}`);
				}
			}
		} catch (e) {
			this.log.error(e);
		}
		return null;
	}
}


function safeGet(get, defaultValue) {
	try {
		return get();
	} catch (e) {
		return defaultValue;
	}
}

function getArray(value) {
	return Array.isArray(value) ? value : [];
}

function getNumber(value, defaultValue) {
	return (typeof(value) === "number" && !Number.isNaN(value)) ? value : defaultValue;
}

function getInteger(value, defaultValue) {
	return (typeof(value) === "number" && !Number.isNaN(value)) ? Math.round(value) : defaultValue;
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

function getFilteredImageList(list, priorityOrder) {
	if (!Array.isArray(priorityOrder)) { return list; }

	const visited = new Array(list.length).fill(false);
	const results = [];
	let index = 0;
	for (let i of priorityOrder) {
		if (i < 0) { i = list.length + i; }
		if (i >= 0 && i < list.length && !visited[i]) {
			index = i;
			visited[index] = true;
			results.push(list[index]);
		}
	}

	if (results.length < list.length) {
		for (let i = 0, ii = list.length; i < ii; ++i) {
			index = (index + 1) % ii;
			if (!visited[index]) {
				visited[index] = true;
				results.push(list[index]);
			}
		}
	}

	return results;
}

function applyPriority(value, newValue) {
	if (newValue.blacklist === true) {
		value.blacklist = true;
	}

	const p = getNumber(newValue.priority, 0.0);
	if (p > 0.0) {
		value.positive += p;
	} else {
		value.negative += p;
	}
	value.total += p;
}

function getTagAndNamespace(tag) {
	const pattern = /^(?:([^:]*):)?([\w\W]*)$/;
	const match = pattern.exec(tag);
	return (match !== null) ?
		({ tag: match[2], namespace: match[1] || null }) :
		({ tag: tag, namespace: null });
}


module.exports = Runner;
