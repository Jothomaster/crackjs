const { dialog } = require('electron');
const fs = require('fs')
const fsPromises = require('fs/promises')
const https = require('https')
const MD5 = require('./md5');
const readline = require('readline');
const { once } = require('events');

function decryptChunk(bigint, prv, n) {
	return qpow(bigint, prv, n);
}

const decryptFile = async (event, pass) => {
	if(!pass) {
		console.log('no pass')
		// todo: inform user
		return;
	}

	const {pub, prv, n} = generateKeys(pass);
	const {stream, filepath} = await showFileDialog();

	if(!stream || !filepath.endsWith('.enc')) {
		console.log('no file')
		// todo: inform user
		return;
	}

	// get stream as readlinestream
	const lineStream = readline.createInterface({
		input: stream,
		crlfDelay: Infinity
	})

	const originalFilePath = filepath.substring(0, filepath.length - 4);

	const writeStream = fs.createWriteStream(originalFilePath);
	// set as utf8 to get string instead of buffer
	let firstLine = true;
	lineStream.on('line', (line) => {
		const decryptedChunk = decryptChunk(BigInt(line), prv, n);

		if(firstLine) {
			if(decryptedChunk !== 2137420n) {
				console.log('wrong password');
				// TODO: inform user
				lineStream.close();
				writeStream.close();
				return;
			}

			firstLine = false;
			return;
		}

        const chunk = decryptedChunk.toString(16).padStart(4, '0').match(/.{1,2}/g).map(x => parseInt(x, 16));
		const buffer = Buffer.from(chunk);
		writeStream.write(buffer);
	});


	await once(lineStream, 'close');
}

const encryptFile = async (event, pass) => {
	if(!pass) {
		console.log('no pass')
		// todo: inform user
		return;
	}
	const {pub, prv, n} = generateKeys(pass);
	const {stream, filepath} = await showFileDialog();

	if(!stream) {
		console.log('no file')
		// todo: inform user
		return;
	}

	stream.pause();
	const writeStream = fs.createWriteStream(filepath + '.enc');
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
			//todo: inform user
			writeStream.close();
			stream.close();
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

module.exports = { encryptFile, decryptFile };