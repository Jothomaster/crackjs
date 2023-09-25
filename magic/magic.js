const { dialog } = require('electron');
const fs = require('fs')
const fsPromises = require('fs/promises')
const https = require('https')
const MD5 = require('./md5');
const readline = require('readline');
const { once } = require('events');
const { fork } = require('child_process');
const path = require('path');

function decryptChunk(bigint, prv, n) {
	return qpow(bigint, prv, n);
}

let controller = new AbortController();
let signal = controller.signal;

let passLength = 1;

const recoverPassword = async (event, mainWindow) => {
	const {stream, filepath} = await showFileDialog();
	if(!stream) {
		console.log('no file')
		mainWindow.webContents.send('notification', {
			message: 'No file chosen.',
			progress: 0,
		});
		return;
	}

	if(!filepath.endsWith('.enc')) {
		console.log('no file')
		mainWindow.webContents.send('notification', {
			message: 'Incorrect file.',
			progress: 0,
		});
		return;
	}
	mainWindow.webContents.send('notification', {
		message: 'Accessing the encrypted file...',
		progress: 0 + Math.random() * 5,
	});

	await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
	const lineStream = readline.createInterface({
		input: stream,
		crlfDelay: Infinity
	});
	mainWindow.webContents.send('notification', {
		message: 'File accessed. Trying to recover the password...',
		progress: 15 + Math.random() * 5,
	});

	let firstLine = true;
	lineStream.on('line', (line) => {
		if(!firstLine) {
			return;
		}

		firstLine = false;

		mainWindow.webContents.send('notification', {
			message: 'Initializing password cracker service.',
			progress: 20,
		});


		if(controller) {
			controller.abort();
		}

		controller = new AbortController();
		signal = controller.signal;
		passLength = 1;


		lineStream.close();
		passwordForker(mainWindow, line);
	});


	await once(lineStream, 'close');

	if(!wrongPass) {
		mainWindow.webContents.send('notification', {
			message: 'File decrypted successfully.',
			progress: 100,
		});
	}
}

function passwordForker(mainWindow, line) {
	const verifier = line;
	const maxPassLength = 8;
	let passCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

	function killChildren() {
		controller.abort();
	}

	mainWindow.webContents.send('notification', {
		message: 'Trying passwords of length ' + passLength + '...',
		progress: 20 + 5 * passLength + Math.random() * 5,
	});

	let combinations = getAllCombinations(passCharacters, passLength);

	const len = combinations.length;

	let children = [];

	const BIRTHS_COUNT = 20;

	let passwordFound = false;

	for(let i = 0; i < BIRTHS_COUNT; i++) {
		const child = fork(path.join(__dirname, 'multithreading.js'), [toString(i)], { signal });
		const childCombination = combinations.splice(0, Math.floor(len / BIRTHS_COUNT));
		child.on('message', (msg) => {
			if(msg.success) {
				passwordFound = true;
				mainWindow.webContents.send('notification', {
					message: 'Password recovered successfully: ' + msg.pass,
					progress: 100,
				});
				dialog.showMessageBox({
					message: 'Password recovered successfully: ' + msg.pass,
					buttons: ['OK']
				});
				killChildren();
			}
		});
		child.on('error', (err) => {
			//ignore
		});
		children.push(child);
		child.send({ verifier, childCombination });
		child.on('exit', () => {
			console.log('child exited')
			children = children.filter(x => x !== child);
			if(children.length === 0 && !passwordFound) {
				passLength++;
				if(passLength > maxPassLength) {
					mainWindow.webContents.send('notification', {
						message: 'Password recovery failed.',
						progress: 0,
					});
				} else {
					passwordForker(mainWindow, line);
				}
			}
		})
	}

}

function getAllCombinations(characters, length) {
	let result = [];
	for (let i = 0; i < characters.length; i++) {
		if (length === 1) {
			result.push(characters[i]);
		} else {
			const combinations = getAllCombinations(characters, length - 1);
			for (let j = 0; j < combinations.length; j++) {
				result.push(characters[i] + combinations[j]);
			}
		}
	}
	return result;
}

const decryptFile = async (event, pass, mainWindow) => {
	if(!pass) {
		console.log('no pass')
		mainWindow.webContents.send('notification', {
			message: 'Missing password.',
			progress: 0,
		});
		return;
	}

	const {stream, filepath} = await showFileDialog();
	if(!stream) {
		console.log('no file')
		mainWindow.webContents.send('notification', {
			message: 'No file chosen.',
			progress: 0,
		});
		return;
	}

	if(!filepath.endsWith('.enc')) {
		console.log('no file')
		mainWindow.webContents.send('notification', {
			message: 'Incorrect file.',
			progress: 0,
		});
		return;
	}

	mainWindow.webContents.send('notification', {
		message: 'Generating keys...',
		progress: Math.random() * 5,
	});
	const {pub, prv, n} = generateKeys(pass);
	await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
	mainWindow.webContents.send('notification', {
		message: 'Keys generated...',
		progress: 5 + Math.random() * 5,
	});

	await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));

	mainWindow.webContents.send('notification', {
		message: 'Accessing the encrypted file...',
		progress: 10 + Math.random() * 5,
	});
	await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
	// get stream as readlinestream
	const lineStream = readline.createInterface({
		input: stream,
		crlfDelay: Infinity
	})
	const originalFilePath = filepath.substring(0, filepath.length - 4);
	let writeStream;
	mainWindow.webContents.send('notification', {
		message: 'File accessed. Decrypting...',
		progress: 15 + Math.random() * 5,
	});

	// set as utf8 to get string instead of buffer
	let firstLine = true;
	let wrongPass = false;
	lineStream.on('line', (line) => {
		if(wrongPass) {
			return;
		}

		const decryptedChunk = decryptChunk(BigInt(line), prv, n);

		if(firstLine) {
			if(decryptedChunk !== 2137420n) {
				wrongPass = true;
				mainWindow.webContents.send('notification', {
					message: 'Wrong password. Try Again. Or use our password recovery service.',
					progress: 0,
				});
				dialog.showErrorBox('Wrong password', 'Wrong password. Try Again.');
				lineStream.close();
				console.log('wrong password');
				return;
			}

			firstLine = false;
			writeStream = fs.createWriteStream(originalFilePath);
			return;
		}

        const chunk = decryptedChunk.toString(16).padStart(4, '0').match(/.{1,2}/g).map(x => parseInt(x, 16));
		const buffer = Buffer.from(chunk);
		writeStream.write(buffer);
	});


	await once(lineStream, 'close');

	if(!wrongPass) {
		mainWindow.webContents.send('notification', {
			message: 'File decrypted successfully.',
			progress: 100,
		});
	}
}

const encryptFile = async (event, pass, mainWindow) => {
	if(!pass) {
		console.log('no pass')
		mainWindow.webContents.send('notification', {
			message: 'Missing password.',
			progress: 0,
		});
		return;
	}
	const {stream, filepath} = await showFileDialog();

	if(!stream) {
		console.log('no file')
		mainWindow.webContents.send('notification', {
			message: 'No file chosen.',
			progress: 0,
		});
		return;
	}
	mainWindow.webContents.send('notification', {
		message: 'Generating keys...',
		progress: Math.random() * 5,
	});

	await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
	const {pub, prv, n} = generateKeys(pass);
	mainWindow.webContents.send('notification', {
		message: 'Keys generated...',
		progress: 5 + Math.random() * 5,
	});
	await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
	mainWindow.webContents.send('notification', {
		message: 'Accessing the original file...',
		progress: 10 + Math.random() * 5,
	});
	await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
	const writeStream = fs.createWriteStream(filepath + '.enc');
	mainWindow.webContents.send('notification', {
		message: 'File accessed. Encrypting...',
		progress: 15 + Math.random() * 5,
	});
	stream.once('readable', () => {
		const encryptedHeader = encryptChunk(2137420n, pub, n);
		console.log(encryptedHeader);
		writeStream.write(encryptedHeader.toString() + '\n');

		function doEncryption() {
			while(true) {
				const chunk = getChunk(stream);
				if (chunk === null) {
					break;
				}

				const encryptedChunk = encryptChunk(chunk, pub, n);

				writeStream.write(encryptedChunk.toString() + '\n');
			}
		}

		doEncryption();

		stream.on('readable', () => {
			doEncryption();
		})

		stream.on('end', () => {
			mainWindow.webContents.send('notification', {
				message: 'File encrypted successfully.',
				progress: 100,
			});
			writeStream.close();
			stream.close();
			console.log('done')
		})
	})
}

const getChunk = (file) => {
	const chunk = file.read(2);

	if (chunk === null) {
		return null;
	}

	const bigData = chunk.toJSON().data.map(x => BigInt(x));
	return bigData.reduce((acc, curr) => acc * 256n + curr, 0n);
}

const encryptChunk = (chunk, pub, n) => {
	return qpow(chunk, pub, n);
}

const generateKeys = (pass) => {
	const hashed = MD5(pass);

	const firstHash = parseInt(hashed.substring(0, 4), 16);
	const secondHash = parseInt(hashed.substring(4, 8), 16);

	const primes = getPrimes(32767, 65565);

	const a = BigInt(primes[firstHash % primes.length])
	const b = BigInt(primes[secondHash % primes.length])

	const fi = (a-1n)*(b-1n);
	const n = a*b;

	let pub = 2137n;

	let prv = egcd(fi, pub)[2];

	while(prv<0){
		prv+=fi;
	}

	console.log(pub,prv,n)

	return {
		pub,
		prv,
		n,
	}


	//zaszyfrowanie
	// let res = data.map(x=>{
	// 	return qpow(x, pub, n);
	// })
	//
	// //odszyfrowanie
	// let res2 = res.map(x=>{
	// 	return qpow(x, prv, n);
	// })
	//
	// console.log(data);
	// console.log(res);
	// console.log(res2);

}

const getPrimes = (min, max) => {
	const result = Array(max + 1)
	.fill(0)
	.map((_, i) => i);
	for (let i = 2; i <= Math.sqrt(max + 1); i++) {
		for (let j = i ** 2; j < max + 1; j += i) delete result[j];
	}
	return Object.values(result.slice(Math.max(min, 2)));
};

const getRandNum = (min, max) => {
	return Math.floor(Math.random() * (max - min + 1) + min);
};

const getRandPrime = (min, max) => {
	const primes = getPrimes(min, max);
	return primes[getRandNum(0, primes.length - 1)];
};


function qpow(a, b, mod){
	let res = 1n;
	while(b){
		if(b&1n){
			res *= a;
			res %= mod;
		}
		a*=a;
		a %= mod;
		b>>=1n;
	}
	return res;
}


function egcd(a,b) {
	if(b==0n){
		return [a, 1n, 0n];
	}
	let [gcd, x, y] = egcd(b, a%b);
	return [gcd, y, x-(a/b)*y];
}


const showFileDialog = async () => {
	const res = await dialog.showOpenDialog({properties: ['openFile'] })

	if (!res.canceled) {
		// return res.filePaths[0];

		// const file = await fsPromises.readFile(res.filePaths[0])
		// console.log(file);
		// return file.toJSON().data;

		// get file as stream
		const stream = fs.createReadStream(res.filePaths[0], {
			start: 0,
			end: Number.MAX_SAFE_INTEGER,
		});
		return {stream, filepath: res.filePaths[0]};

	} else {
		return null;
	}
}

module.exports = { encryptFile, decryptFile, recoverPassword, decryptChunk, generateKeys };