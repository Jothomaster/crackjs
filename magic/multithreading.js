const { generateKeys, decryptChunk } = require('./magic');
process.on('message', (msg) => {
	const combinations = msg.childCombination;
	const stringVerifier = msg.verifier;
	const verifier = BigInt(stringVerifier);

	console.log(combinations.length);

	for (let i = 0; i < combinations.length; i++) {
		const { pub, prv, n } = generateKeys(combinations[i]);
		const decryptedChunk = decryptChunk(verifier, prv, n);
		if (decryptedChunk === 2137420n) {
			process.send({
				success: true,
				pass: combinations[i],
			})
		}
	}

	console.log(process.argv[2]);
	console.log("No pass found: fork " + process.argv[2] + " exiting...");
	process.exit(0);
});