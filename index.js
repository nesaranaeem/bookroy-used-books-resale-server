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

    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //get doctors

    //insert price
    // temporary to update price field on appointment options
    // app.get("/add-price", async (req, res) => {
    //   const filter = {};
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: {
    //       price: 99,
    //     },
    //   };
    //   const result = await appointmentOptionsCollection.updateMany(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });
  } finally {
  }
};

run().catch((err) => console.error(err));
