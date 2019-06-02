"use strict";

const htmlEntities = require("html-entities"); // 3rd-party


function getStringFromHtmlEscapedString(value) {
	if (value === null) { return null; }

	const e = new htmlEntities.AllHtmlEntities();
	return e.decode(value);
}


module.exports = {
	getStringFromHtmlEscapedString
};
