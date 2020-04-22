let cfg = require('./switch.cfg'),
	log = console.log,
	shell = require("shelljs"),
	rp = require('request-promise'),
	request = require('request'),
	fs = require('fs'),
	headers = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.98 Safari/537.36",
		"Content-type": "text/html"
	},
	headersGzip = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.98 Safari/537.36',
		'Content-type': 'text/html',
		'Accept-Encoding': 'gzip, deflate'
	},
	page = "/pgajax.axd?T=SyncImages";
const TIME_DELAY_EACH_DOWNLOADING_FILE = 150;

async function saveFile(fileName, content) {
	return new Promise((resolve, reject) => {
		fs.writeFile(fileName, content, function (err) {
			if (err) reject(err)
			//var statusText = 'write file > ' + fileName + ' success'
			//log(statusText)
			resolve(true)
		})
	})
}

async function getPaths(host, stringSplit) {
	let protocol = cfg.protocol,
		url = protocol + host + page,
		options = {
			uri: url,
			headers: headers,
			resolveWithFullResponse: true,
			transform: function (body) {
				return body.replace(/\\/g, "/");
			}
		}
	log("Syncing :%s", url);
	var paths = await rp(options)
	paths = JSON.parse(paths);
	paths = this.formatPath(paths, stringSplit);
	return paths;
}

/**
* stringSplit(Images,C:\\...)
*/
function formatPath(paths, stringSplit) {
	let newPaths = []
	for (let path of paths) {
		let extension = getFileExtension(path)
		if (extension !== 'db' && extension !== 'onetoc2' && extension !== path) {
			path = path.substring(path.indexOf(stringSplit) + 6, path.length);
			newPaths.push(path)
		}
	}
	return newPaths
}
//0.02 mls
function getFileName(fullPath) {
	return fullPath.split('\\').pop().split('/').pop();
}
function getFileExtension(fullPath) {
	return fullPath.split('.').pop()
}
async function fetchTextFile(url) {
	try {
		return await rp({
			uri: url,
			headers: headersGzip,
			gzip: true
		})
	} catch (error) {
		log(error)
	}
}
async function downloadFile(pathImage, host, syncFolder) {
	// prepare folders
	//log('pathImage:%s', pathImage)
	let url = cfg.protocol + host + '/' + pathImage,
		rootFolderImages = cfg.rootFolderImages,
		fileName = pathImage.split('/').slice(-1)[0],
		fullFileName = rootFolderImages + pathImage,
		dir = rootFolderImages + pathImage.substring(0, pathImage.indexOf(fileName) - 1)
	log(fullFileName)
	if (syncFolder) {
		dir = dir.replace('Images', 'Images_WLs/' + syncFolder)
		fullFileName = fullFileName.replace('Images/', 'Images_WLs\\' + syncFolder + '\\')
	}
	log(fullFileName)
	//log(dir)
	//log(url)
	if (!fs.existsSync(dir)) shell.mkdir('-p', dir)
	// fetch image from internet
	try {
		switch (fileName.substring(fileName.lastIndexOf('.') + 1, fileName.length)) {
			case 'js':
			case 'css':
			case 'htm':
			case 'html':
			case 'download':
				saveFile(fullFileName, await fetchTextFile(url))
				break;
			default:
				request(url)
					.on('error', err => {
						log('==> error at pathImage: %s', pathImage)
						//log(err)
					})
					//.on('response', response => log(response.statusCode))
					.pipe(fs.createWriteStream(fullFileName));
				// error msg is red, cant overwrite it
				//rp.get({ uri: url, encoding: null }).then(bufferAsBody => fs.writeFileSync(fullFileName, bufferAsBody))
				break;
		}
	} catch (error) {
		log(`${error.statusCode} ==> ${pathImage}`)
	}

}
async function downloadFiles(indexPath, paths, host, next, syncFolder) {
	let currentPath = paths[indexPath];
	log("paths[%s]=%s", indexPath, currentPath);
	downloadFile(currentPath, host, syncFolder);
	indexPath = indexPath + 1
	if (indexPath < paths.length)
		setTimeout(async () => await downloadFiles(indexPath, paths, host, next, syncFolder), TIME_DELAY_EACH_DOWNLOADING_FILE);
	else {
		log("Downloaded %s files in Images folder", paths.length);
		next()
	}
}
async function getSwitchCfg() {
	try {
		return JSON.parse(await rp({
			uri: cfg.urlProject + 'pgajax.axd?T=GetSwitchCfg',
			headers: headers
		}))
	} catch (error) {
		log(error)
	}
}
async function getDHNumber(whiteLabelName) {
	try {
		let result = await getSwitchCfg()
		return result['Clients'][whiteLabelName.toUpperCase()]
	} catch (error) {
		log(error)
	}
}

// save image to Images_WLs\Images_<WhiteLabelName
async function syncImagesWL(whiteLabelName) {
	let host = 'www.' + whiteLabelName + '.com',
		paths = await sync.getPaths(host, 'WebUI')
	downloadFiles(0, paths, host, () => log('Done'))
}
module.exports = {
	getPaths: getPaths,
	formatPath: formatPath,
	downloadFile: downloadFile,
	downloadFiles: downloadFiles,
	getSwitchCfg: getSwitchCfg,
	getDHNumber: getDHNumber
};