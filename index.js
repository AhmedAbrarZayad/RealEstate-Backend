const express = require('express');
const app = express();
const admin = require('firebase-admin');
require('dotenv').config();


var serviceAccount = require("../realestate-fbcf5-firebase-adminsdk-fbsvc-0aded39002.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// PORT
const port = process.env.PORT || 4000;

// MONGODB PASSWORD
const mongodbPass = process.env.MONGODB_PASS;

// CROSS ORIGIN RESOURCE SHARING (CORS) MIDDLEWARE
const cors = require('cors');
app.use(cors());
app.use(express.json());

// Middleware
async function verifyFirebaseJWTToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const idToken = authHeader.split(' ')[1];

    if(!idToken){
        return res.status(401).json({ message: 'No token provided' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; 
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(403).json({ message: 'Unauthorized or invalid token' });
  }
}

// APIS
app.get('/', (req, res) => {
    res.send(`Hello`);
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

    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // User APIs
    app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email };

        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
            return res.status(200).json({ message: 'User already exists', existingUser: true });
        }

        const result = await usersCollection.insertOne(user);
        res.status(201).json({ message: 'User created successfully', result });
    });
    app.get('/users', verifyFirebaseJWTToken, async (req, res) => {
        const email = req.query.email;
        if(email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const id = {_id: user._id};
        res.send(id);
    });
    app.get('/users/:id', verifyFirebaseJWTToken, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const user = await usersCollection.findOne(query);
        if(user.email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        res.send(user);
    });
    app.get('/users/:id/properties', verifyFirebaseJWTToken, async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const user = await usersCollection.findOne(query);
        if(user.email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        const propertyIds = user.properties || [];
        const objectIds = propertyIds.map(pid => new ObjectId(pid));
        const properties = await propertyCollection.find({ _id: { $in: objectIds } }).toArray();
        res.send(properties);
    });

    app.patch('/users/:id/properties/:propertyId', verifyFirebaseJWTToken, async (req, res) => {
        const id = req.params.id;
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if(user.email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        if(!user.properties || !user.properties.includes(req.params.propertyId)){
            return res.status(403).json({ message: 'Forbidden access to this property' });
        }
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

    app.delete('/users/:id/properties/:propertyId', verifyFirebaseJWTToken, async (req, res) => {
        const id = req.params.id;
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if(user.email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        if(!user.properties || !user.properties.includes(req.params.propertyId)){
            return res.status(403).json({ message: 'Forbidden access to this property' });
        }
        const query = { _id: new ObjectId(req.params.propertyId) };
        const result = await propertyCollection.deleteOne(query);
        res.send(result);
    });
    // Property APIs
    app.post('/property', verifyFirebaseJWTToken, async (req, res) => {
        const email = req.query.email;
        if(email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        console.log(req.body);
        console.log(email);
        const property = req.body;
        const result = await propertyCollection.insertOne(property);
        await usersCollection.updateOne(
            { email: email },
            { $push: { properties: result.insertedId.toString() } }
        );
    
        res.send(result);
    })

    app.get('/property', async (req, res) => {
        try {
            const sortBy = req.query.sortBy || 'price'; // default field to sort
            const order = req.query.order === 'desc' ? -1 : 1; // default ascending
            const searchQuery = req.query.search || ''; // search query
            
            const query = {};

            // Add search filter if search query exists
            if (searchQuery) {
                query.name = { $regex: searchQuery, $options: 'i' }; // case-insensitive search
            }

            // Fetch properties with sorting and search
            const cursor = propertyCollection.find(query).sort({ [sortBy]: order });
            const properties = await cursor.toArray();

            res.json(properties);
        } catch (error) {
            console.error('Error fetching properties:', error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    
    app.get('/my-properties', verifyFirebaseJWTToken, async (req, res) => {
        try{
            const email = req.query.email;
            if(email !== req.user.email){
                return res.status(403).json({ message: 'Forbidden access' });
            }
            console.log(email);
            const user = await usersCollection.findOne({ email: email });
            const propertyIds = user.properties || [];
            const objectIds = propertyIds.map(pid => new ObjectId(pid));
            const properties = await propertyCollection.find({ _id: { $in: objectIds } }).toArray();
            res.send(properties);
        }
        catch(err){
            console.error('Error fetching my properties:', err);
            res.status(500).json({ message: 'Server error' });
        }
    });

    app.delete('/my-properties/:propertyId', verifyFirebaseJWTToken, async (req, res) => {
        const email = req.query.email;
        if(email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        const propertyId = req.params.propertyId;
        const result = await propertyCollection.deleteOne({ _id: new ObjectId(propertyId) });
        await usersCollection.updateOne(
            { email: email },
            { $pull: { properties: propertyId } }
        );
        res.send(result);
    });
    app.get('/not-my-properties', verifyFirebaseJWTToken, async (req, res) => {
        const email = req.query.email;
        if(email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        const user = await usersCollection.findOne({ email: email });
        const propertyIds = user.properties || [];
        const objectIds = propertyIds.map(pid => new ObjectId(pid));
        const properties = await propertyCollection.find({ _id: { $nin: objectIds } }).toArray();
        res.send(properties);
    });
    app.patch('/my-properties/:propertyId', verifyFirebaseJWTToken, async (req, res) => {
        const email = req.query.email;
        if(email !== req.user.email){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        const propertyId = req.params.propertyId;
        const updatedProperty = req.body;
        const updateDoc = {
            $set: {
                name: updatedProperty.name,
                description: updatedProperty.description,
                category: updatedProperty.category,
                location: updatedProperty.location,
                price: updatedProperty.price,
                imageLink: updatedProperty.imageLink
            }
        };
        const result = await propertyCollection.updateOne({ _id: new ObjectId(propertyId) }, updateDoc);
        res.send(result);
    });

    app.get('/property/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const property = await propertyCollection.findOne(query);
        res.send(property);
    })

    // Review APIs
    app.post('/reviews', verifyFirebaseJWTToken, async (req, res) => {
        const review = req.body;
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
    });
    app.get('/reviews', verifyFirebaseJWTToken, async (req, res) => {
        const email = req.query.email;
        const query = {}
        if(email){
            if(email !== req.user.email){
                return res.status(403).json({ message: 'Forbidden access' });
            }
            const user = await usersCollection.findOne({ email: email });
            query.reviewerId = user._id.toString();
        }
        const cursor = reviewsCollection.find(query);
        const reviews = await cursor.toArray();
        res.send(reviews);
    });
    app.get('/reviews/:propertyId', async (req, res) => {
        const propertyId = req.params.propertyId;
        const query = { propertyId: propertyId };
        const cursor = reviewsCollection.find(query);
        const reviews = await cursor.toArray();
        res.send(reviews);
    });
    app.patch('/reviews/:id', verifyFirebaseJWTToken, async (req, res) => {
        const userEmail = req.user.email;
        const cursor = usersCollection.find({ email: userEmail });
        const user = await cursor.toArray();
        const userId = user[0]._id;
        const id = req.params.id;
        const review = await reviewsCollection.findOne({ _id: new ObjectId(id) });
        if(review.reviewerId.toString() !== userId.toString()){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        const updatedReview = req.body;
        const updateDoc = {
            $set: {
                starRating: updatedReview.starRating,
                reviewText: updatedReview.reviewText
            }
        };
        const result = await reviewsCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
        res.send(result);
    });
    app.delete('/reviews/:id', verifyFirebaseJWTToken, async (req, res) => {
        const userEmail = req.user.email;
        const cursor = usersCollection.find({ email: userEmail });
        const user = await cursor.toArray();
        const userId = user[0]._id;
        const id = req.params.id;
        
        const review = await reviewsCollection.findOne({ _id: new ObjectId(id) });
        if(review.reviewerId.toString() !== userId.toString()){
            return res.status(403).json({ message: 'Forbidden access' });
        }
        
        const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
    });


  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);




module.exports = app;
