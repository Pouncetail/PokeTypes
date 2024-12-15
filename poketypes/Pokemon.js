process.stdin.setEncoding("utf8");
const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, '.env') })  
const MONGO_CONNECTION_STRING = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.rrl20.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = MONGO_CONNECTION_STRING;

const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');
const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });


if (process.argv.length !== 3){
	console.log("Usage Pokemon.js portNumber");
	process.exit(0)
}

const portNumber = process.argv[2];
console.log(`Web server is running at http://localhost:${portNumber}/`);

async function close() {
    await client.close();
}

console.log("Stop to shutdown the server: ");
process.stdin.on('readable', () => {
	const input = process.stdin.read();
	if (input !== null) {
		const command = input.trim();
		if (command === "stop") {
			console.log("Shutting down the server");
            close();
            process.exit(0);
		} else {
			console.log(`Invalid command: ${command}`);
		}
		console.log("Stop to shutdown the server: ");
		process.stdin.resume();
    }
});

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.static(path.join(__dirname, 'templates')));

app.get("/", (request, response) => {
	response.render('index');
});

app.get("/guess", (request, response) => {
	const id = Math.floor(Math.random() * 150) + 1;
	let typeString = "";
	let weight;
	async function fetchRandomData(){
		try {
			const poke = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
			const data = await poke.json();
			weight = (2.205 * (data.weight / 10));
			for (let i = 0; i < data.types.length; i++) {
				typeString += data.types[i].type.name;
				if (i < data.types.length - 1) {
                    typeString += ", "; 
                }
			}
			const pokeImage = data.sprites.front_default;
			const variable = 
				{id: id, 
				weight: weight,
				types: typeString,
				image: pokeImage};
			response.render('guess', variable);
		} catch (e) {
			console.error(e);
		}
	}

	fetchRandomData().catch(console.error);
});

app.post("/processGuess", (request, response) => {
	let {username, guess} = request.body;
	guess = guess.trim().toLowerCase()
	const pokemonId = request.body.id;
	async function fetchCorrectName(){
		try {
			const poke = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
			const data = await poke.json();
			const correctName = data.name; 
			//name should be in lowercase by api
			let ret = '';
			const pokeImage = data.sprites.front_default;
			if(guess === correctName){
				console.log("win")
				let filter = {username: username};
    			let user = await client.db(databaseAndCollection.db)
					.collection(databaseAndCollection.collection)
					.findOne(filter);
				if (user == null){
					await client.db(databaseAndCollection.db)
						.collection(databaseAndCollection.collection)
						.insertOne({username: username,
							points: 1
						});
				} else {
					let newpoint = user.points + 1;
					await client.db(databaseAndCollection.db)
						.collection(databaseAndCollection.collection)
						.updateOne({username: username}, {$set:{points:newpoint}});
				}
				user = await client.db(databaseAndCollection.db)
					.collection(databaseAndCollection.collection)
					.findOne(filter);
				ret = `<h1>You got it! It's ${correctName} <br>
					<img src="${pokeImage}"> <br>
					Your answer: ${guess} !<br>
					You currently have ${user.points} points</h1>`;
			} else {
				console.log("lose")
				ret = `<h1>So close!  It was ${correctName} <br> 
					<img src="${pokeImage}"> <br>
					Your answer: ${guess} <br> </h1>`;
			}
			const variable = {text: ret};
			response.render('processGuess', variable);
		} catch (e) {
			console.error(e);
		}
	}
	fetchCorrectName().catch(console.error);
  });
app.listen(portNumber);