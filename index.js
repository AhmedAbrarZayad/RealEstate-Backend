const express = require('express');
const app = express();
const admin = require('firebase-admin');
require('dotenv').config({ path: '../.env' });

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

    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // User APIs
    app.post('/users', async (req, res) => {
        const user = req.body;
        const result = await usersCollection.insertOne(user);
        res.send(result);
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
        const property = req.body;
        await usersCollection.updateOne(
            { email: email },
            { $push: { properties: property._id } }
        );
        const result = await propertyCollection.insertOne(property);
    
        res.send(result);
    })

    app.get('/property', verifyFirebaseJWTToken, async (req, res) => {
        const email = req.query.email;
        const query = {};
        if(email){
            if(email !== req.user.email){
                return res.status(403).json({ message: 'Forbidden access' });
            }
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




app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});