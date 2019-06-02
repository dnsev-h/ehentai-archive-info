# config.json

The config file stores settings used to control how the program operates.
The default settings are set up for the general use case, but they can be further
adjusted depending on the needs.

```js
{
  // General settings.
  "general": {
    // The name of the log file. Can be null for no log.
    "logFileName": "log.txt",
    // List of paths to attempt to use when trying to run 7zip.
    "sevenZipExeSearchLocations": [
      "7z",
      "C:\\Program Files\\7-Zip\\7z",
      "C:\\Program Files (x86)\\7-Zip\\7z"
    ]
  },

  // E*Hentai lookup settings.
  "lookup": {
    // Path to file storing authentication cookie information for ExHentai.
    // See "Cookies" section below for more info.
    "exCookiesFileName": "cookies.txt",
    // Whether or not expunged galleries should be searched.
    // If this setting is enabled, priority is given to non-expunged galleries.
    "searchExpunged": true,
    // Whether or not searches for only cover pages should be used.
    // This option is only used for the first page of the gallery that is searched.
    "searchCoversOnly": false,
    // Maximum number of images to fetch metadata for and compare.
    "maximumNumberOfResultsToCheck": 25,
    // Delay settings for different types of HTTP requests.
    "delay": {
      // Minimum delay between gallery searches (in seconds).
      "gallerySearch": 5.0,
      // Minimum delay between API calls (in seconds).
      "apiCall": 5.0,
      // Whether or not any remaining delays should be skipped when the script is exiting.
      "skipOnCompletion": false
    },
    // Options for calculating the priority when there are multiple results.
    // Priorities are summed and used to determine the highest-priority result.
    // This result is used as the correct gallery metadata.
    "priorities": {
      // Priority options for tags. The "value" field can contain a tag namespace.
      "tags": [
        { "value": "misc:already uploaded", "priority": -1.0, "blacklist": false },
        { "value": "misc:incomplete", "priority": -1.0, "blacklist": false }
      ],
      // Priority options for the language. If the "value" is null, this is treated
      // as the default if no language matches were detected.
      "language": [
        { "value": "english", "priority": 2.0 },
        { "value": "japanese", "priority": 1.0 },
        { "value": null, "priority": -1.0, "blacklist": false }
      ],
      // Title priority options. Regular expressions can be used if the "value" field
      // is prefexed with "regex:".
      "title": [
        { "value": "regex:colorized", "priority": 0.0 }
      ],
      "titleOriginal": [
        { "value": "regex:カラー化", "priority": 0.0 }
      ],
      // Priority options based on how many files are in the gallery.
      "fileCount": {
        // Adds priority to the gallery with the amount of images to the local copy.
        "nearest": { "priority": 0.5 },
        // Adds priority to the gallery with the largest number of images.
        "highest": { "priority": 0.0 },
        // Adds priority to the gallery that had the largest number of
        // reverse image search results.
        "highestSearchMatches": { "priority": 1.0 }
      }
    }
  },

  // Options for scanning local files.
  "scanning": {
    // Whether or not folders should be scanned for archive files (.zip, .rar).
    "scanFoldersForArchives": true,
    // Whether or not folders should be scanned for archive images.
    // If a folder contains images, it may be detected as a gallery folder.
    "scanFoldersForImages": true,
    // Maximum permitted depth to scan into folders.
    "scanFoldersRecursiveDepth": 10,
    // Whether or not to scan child directories of folders that are determined
    // to be a gallery folder.
    "archiveFolderPermitNestedDirectores": true,
    // Array of file names to ignore. Regular expressions can be used.
    "ignoreFiles": [
      // This regular expression ignores all files beginning with a period.
      "regex:^\\."
    ],
    // Array of directory names to ignore. Regular expressions can be used.
    "ignoreDirectories": [
      // This regular expression ignores all files beginning with a period.
      "regex:^\\.",
      // This rule will cause folders named "node_modules" (case insensitive)
      // to be ignored.
      "node_modules"
    ],
    // Besides images, a list of file extensions that are permitted to
    // inside folders to allow the folder to be qualified as a gallery folder.
    "archiveFolderPermittedExtensions": [
      ".txt",
      ".json"
    ],
    // A list of image file extensions.
    "imageFileExtensions": [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp"
    ],
    // A list of archive file extensions.
    "archiveFileExtensions": [
      ".zip",
      ".rar",
      ".7z",
      ".cbr",
      ".cbz"
    ]
  },

  // Options for how to handle different types of archives.
  "archive": {
    // File archive options. Applies to files like .zip, .cbz, etc.
    "file": {
      // Minimum number of images to search for.
      "minImagesToCheck": 1,
      // Maximum number of images to search for.
      "maxImagesToCheck": 5,
      // Maximum number of errors allowed to be encountered before
      // aborting searches.
      "maxSearchErrors": 1,
      // Whether or not to continue to reverse search images if the
      // number of results are ambiguous.
      "continueSearchIfResultsAreAmbiguous": true,
      // The order in which to search for images from galleries.
      // This array can be used to skip images or change the order.
      // Values are 0-indexed, so 0 corresponds to the first image.
      // Negative values count from the end of the gallery,
      // so -1 would be the last image, -2 the second to last, etc.
      "preferredImageOrder": [ 0, 1, 2, 9 ],
      // Name of the metadata JSON file to write into archive files.
      "metadataFileNameInArchiveFile": "info.json",
      // Name of the metadata JSON file to write into the containing folder.
      // A value of null indicates to not create a file.
      "metadataFileNameInFolder": null,
      // Name of the metadata JSON file to write into the containing folder
      // if the file cannot be added to the archive file.
      // See "Replacement Tags" section below for info about ${name}.
      "metadataFileNameInFolderOnFailure": "${name}.info.json",
      // List of file names. If a file exists in the archive with a name
      // contained in the list, the archive will not be processed.
      // These lists are used to detect if the archive already has
      // a metadata file.
      "skipIfFileExistsInArchiveFile": [ "info.json" ],
      // List of file names. If a file exists in the archive's folder with
      // a name contained in the list, the archive will not be processed.
      "skipIfFileExistsInFolder": [ "${name}.info.json" ]
    },
    // Folder archive options. Applies to folders which contain images directly.
    // The format is roughly the same as above.
    "folder": {
      "minImagesToCheck": 1,
      "maxImagesToCheck": 5,
      "maxSearchErrors": 1,
      "continueSearchIfResultsAreAmbiguous": true,
      "preferredImageOrder": [ 0, 1, 2, 9 ],
      "metadataFileNameInFolder": "info.json",
      // Name of JSON metadata file placed in the archive folder's parent folder.
      // A value of null indicates to not create a file.
      "metadataFileNameInParentFolder": null,
      "skipIfFileExistsInFolder": [ "info.json" ],
      // List of file names. If a file exists in the archive's parent folder with
      // a name contained in the list, the archive will not be processed.
      "skipIfFileExistsInParentFolder": [ "${name}.info.json" ]
    }
  }
}
```


## Replacement Tags

Metadata file names can also be formatted with specific tags to help disambiguate them if necessary.
Currently the only tag is ```${name}``` which corresponds to the name of the archive file or folder,
excluding the file extension.


## Cookies

By default, E-Hentai will be used rather than ExHentai.
If you want to use ExHentai, you must set up the required authentication cookies.
You can do this by creating a file called ```cookies.txt``` next to the ```config.json``` file
and saving a cookie string into the contents. The cookie string should not contain any quotes.

To find your cookie string, open a web browser which is already logged in, open the website,
and then open the browser's developer tools (shortcut key: F12). Then, navigate to the
Console tab and type/paste the following code:
```js
console.log(document.cookie)
```

This should print your cookie string to the console. For example, the cookie string may look something like this:
```
ipb_member_id=XXXXXXX; ipb_pass_hash=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX; igneous=XXXXXXXXX
```
