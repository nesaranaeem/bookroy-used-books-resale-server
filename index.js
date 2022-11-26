const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());
//mongodb

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.k8qegec.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
const run = async () => {
  try {
    const usersCollection = client.db("bookRoy").collection("users");
    const productsCollection = client.db("bookRoy").collection("products");
    const categoriesCollection = client.db("bookRoy").collection("categories");
    const reportsCollection = client.db("bookRoy").collection("reports");

    //verify admin or not
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { userEmail: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.userRole !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //verify seller or not
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { userEmail: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.userRole !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    //tokens
    app.post("/jwt", (req, res) => {
      user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });
    app.get("/users/admin/:userEmail", async (req, res) => {
      const userEmail = req.params.userEmail;
      const query = { userEmail };
      console.log(query);
      const user = await usersCollection.findOne(query);
      console.log(user);
      res.send({ isAdmin: user?.userRole === "admin" });
    });
    //match buyer
    app.get("/buyer/:userEmail", async (req, res) => {
      const userEmail = req.params.userEmail;
      const query = { userEmail };
      const user = await usersCollection.findOne(query);
      res.send({ isBuyer: user?.userRole === "buyer" });
    });
    //match seller
    app.get("/seller/:userEmail", async (req, res) => {
      const userEmail = req.params.userEmail;
      const query = { userEmail };
      console.log(query);
      const user = await usersCollection.findOne(query);
      console.log(user);
      res.send({ isSeller: user?.userRole === "seller" });
    });
    //get sellers product
    app.get("/products", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      if (decoded.email !== req.query.email) {
        res.status(403).send({ message: "Unauthorized Access" });
      }
      let query = {};
      if (req.query.email) {
        query = {
          productPostedBy: req.query.email,
        };
      }
      console.log("seller", req.query.email);
      const cursor = productsCollection.find(query);
      const productsBy = await cursor.toArray();
      res.send(productsBy);
    });
    //delete product of seller
    app.delete("/product/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(filter);
      res.send(result);
    });
    //promote seller
    app.put("/product/:id", verifyJWT, verifySeller, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { userEmail: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.userRole !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isAdvertise: true,
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    //get users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    //all seller
    app.get("/seller", verifyJWT, async (req, res) => {
      const query = { userRole: "seller" };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    //all buyer
    app.get("/buyers", async (req, res) => {
      const query = { userRole: "buyer" };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    //delete user
    app.delete("/user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    //all seller
    app.get("/sellers", async (req, res) => {
      const query = { userRole: "seller" };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { userEmail: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.userRole !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          userRole: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    //verify seller
    app.put("/user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { userEmail: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.userRole !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isSellerVerified: true,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //post product
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const doctor = req.body;
      const result = await productsCollection.insertOne(doctor);
      res.send(result);
    });
    //get promoted products
    app.get("/promoted-products", async (req, res) => {
      const query = { isAdvertise: true, productStatus: "available" };
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });
    //get product owner
    app.get("/idDetails", async (req, res) => {
      const query = {
        userEmail: req.query.email,
      };

      const cursor = usersCollection.find(query);
      const id = await cursor.toArray();
      res.send(id);
    });
    //get product from category
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { productCategory: id, productStatus: "available" };
      const sort = { length: -1 };
      const cursor = productsCollection.find(query).sort({ _id: -1 });
      const review = await cursor.toArray();
      res.send(review);
    });
    //get product details
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const product = await productsCollection.findOne(query);
      res.send(product);
    });
    //get all products
    app.get("/all-product", async (req, res) => {
      const query = { productStatus: "available" };
      const sort = { length: -1 };
      const cursor = productsCollection.find(query).sort({ _id: -1 });
      const review = await cursor.limit(6).toArray();
      res.send(review);
    });
    //get users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await productsCollection.find(query).toArray();
      res.send(users);
    });
    //stripe
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "1h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });

    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoriesCollection.find(query).toArray();
      res.send(categories);
    });
    //post report
    app.post("/reports", verifyJWT, async (req, res) => {
      const data = req.body;
      const result = await reportsCollection.insertOne(data);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
  } finally {
  }
};

run().catch((err) => console.error(err));
