const express = require('express');
const app = express();
require('dotenv').config({ path: '../.env' });

// PORT
const port = process.env.PORT || 4000;

// MONGODB PASSWORD
const mongodbPass = process.env.MONGODB_PASS;

// CROSS ORIGIN RESOURCE SHARING (CORS) MIDDLEWARE
const cors = require('cors');
app.use(cors());
app.use(express.json());

// Middleware

app.get('/', (req, res) => {
    res.send(`${mongodbPass}`);
});



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://ahmedabrarzayad_db_user:ehTQ7NWEIDfaYEOn@cluster0.ccvlctc.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const database = client.db("estatesDB");
    const propertyCollection = database.collection("property");
    const usersCollection = database.collection("users");
    const reviewsCollection = database.collection("reviews");

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // User APIs
    app.post('/users', async (req, res) => {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.send(result);
    });

    app.get('/users/:id/properties', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const user = await usersCollection.findOne(query);
        const propertyIds = user.properties || [];
        const objectIds = propertyIds.map(pid => new ObjectId(pid));
        const properties = await propertyCollection.find({ _id: { $in: objectIds } }).toArray();
        res.send(properties);
    });

    app.patch('/users/:id/properties/:propertyId', async (req, res) => {
        const id = req.params.id;
        const propertyId = req.params.propertyId;
        const newProperty = req.body;

        const updateProperty = {
            $set: {
                name: newProperty.name,
                description: newProperty.description,
                category: newProperty.category,
                location: newProperty.location,
                price: newProperty.price,
                imageLink: newProperty.imageLink
            }
        }
        const result = await propertyCollection.updateOne({ _id: new ObjectId(propertyId) }, updateProperty);
    })

    app.delete('/users/:id/properties/:propertyId', async (req, res) => {
        const query = { _id: new ObjectId(req.params.propertyId) };
        const result = await propertyCollection.deleteOne(query);
        res.send(result);
    });
    // Property APIs
    app.post('/property', async (req, res) => {
        const email = req.query.email;
        console.log(req.body);
        const property = req.body;
        await usersCollection.updateOne(
            { email: email },
            { $push: { properties: property._id } }
        );
        const result = await propertyCollection.insertOne(property);
    
        res.send(result);
    })

    app.get('/property', async (req, res) => {
        const email = req.query.email;
        const query = {};
        if(email){
            query.email = email;
        }
        const cursor = propertyCollection.find(query);
        const properties = await cursor.toArray();
        res.send(properties);
    })

    app.get('/property/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const property = await propertyCollection.findOne(query);
        res.send(property);
    })

  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);




app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});