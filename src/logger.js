"use strict";

class Logger {
	constructor(infoStream, errorStream, logStream) {
		this.infoStream = infoStream;
		this.errorStream = errorStream;
		this.logStream = logStream;

		this.infoStreamVerbose = false;
		this.errorStreamVerbose = false;
		this.logStreamVerbose = true;

		this.verbose = false;
		this.newline = "\r\n";

		this.useColor = true;
		this.counts = {
			info: 0,
			error: 0,
			debug: 0,
			total: 0
		};
	}

	info(...messages) {
		logToStream(this.infoStream, this.infoStreamVerbose || this.verbose, "", this.newline, messages);
		logToStream(this.logStream, this.logStreamVerbose || this.verbose, "INFO: ", this.newline, messages);
		++this.counts.info;
		++this.counts.total;
	}
	successInfo(...messages) {
		const prefix = this.useColor ? "\x1b[1m\x1b[32m" : ""; // green
		const suffix = this.useColor ? "\x1b[0m" : ""; // reset
		logToStream(this.infoStream, this.infoStreamVerbose || this.verbose, prefix, suffix + this.newline, messages);
		logToStream(this.logStream, this.logStreamVerbose || this.verbose, "INFO: ", this.newline, messages);
		++this.counts.info;
		++this.counts.total;
	}
	error(...messages) {
		const prefix = this.useColor ? "\x1b[1m\x1b[31m" : ""; // red
		const suffix = this.useColor ? "\x1b[0m" : ""; // reset
		logToStream(this.errorStream, this.errorStreamVerbose || this.verbose, prefix, suffix + this.newline, messages);
		logToStream(this.logStream, this.logStreamVerbose || this.verbose, "ERROR: ", this.newline, messages);
		++this.counts.error;
		++this.counts.total;
	}
	debug(...messages) {
		logToStream(this.logStream, this.logStreamVerbose || this.verbose, "DEBUG: ", this.newline, messages);
		++this.counts.debug;
		++this.counts.total;
	}

	end() {
		return new Promise((resolve) => {
			if (this.logStream !== null) {
				this.logStream.end(() => resolve());
			}
		});
	}
}


function messageToString(message, verbose) {
	if (typeof(message) === "string") {
		return message;
	}

	if (message instanceof Error) {
		return verbose ? message.stack || message.toString() : message.toString();
	}

	return JSON.stringify(message);
}

function logToStream(stream, verbose, prefix, suffix, messages) {
	if (stream === null) { return; }
	const s = messages.map(message => messageToString(message, verbose)).join(" ");
	stream.write(s ? `${prefix}${s}${suffix}` : `${s}${suffix}`);
}


module.exports = Logger;
