"use strict";

const request = require("request"); // 3rd-party


async function get(url, jar) {
	return new Promise((resolve, reject) => {
		request.get({ url, jar, encoding: null }, (err, response, body) => {
			if (err) {
				reject(err);
			} else {
				resolve({ response, body });
			}
		});
	});
}

async function postJson(url, jar, json) {
	return new Promise((resolve, reject) => {
		request.post({ url, jar, json, encoding: null }, (err, response, body) => {
			if (err) {
				reject(err);
			} else {
				resolve({ response, body });
			}
		});
	});
}

function jar(...args) {
	return request.jar(...args);
}

function cookie(...args) {
	return request.cookie(...args);
}


module.exports = {
	get,
	postJson,
	jar,
	cookie
};
