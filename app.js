const express = require("express");
const path = require("path");
const bp = require("body-parser");
const cors = require("cors");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
  })
);

app.use(
  cors({
    methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
  })
);

app.use(bp.json());
app.use(bp.urlencoded({ extended: true }));
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        console.log(payload);
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { id, username, password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (id,username,password) 
      VALUES 
        (
          '${id}',
          '${username}',
          '${hashedPassword}'
         )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.post("/todos/", authenticateToken, async (request, response) => {
  const { id, user_id, description, status } = request.body;
  const getTodos = `
  INSERT INTO
    todo (id, user_id, description,status)
  VALUES
    ('${id}', '${user_id}', '${description}','${status}');`;
  await db.run(getTodos);
  response.send("Todos Successfully Added");
});

app.delete("/todos/:id/", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const deleteId = `
  DELETE FROM
    todo
  WHERE
    id = ${id} 
  `;
  await db.run(deleteId);
  response.send("todo Removed");
});

app.get("/todos/", authenticateToken, async (request, response) => {
  const getAllTodos = `
    SELECT
      *
    FROM
      todo;`;
  const todosArray = await db.all(getAllTodos);
  response.send(todosArray);
});

app.put("/todos/:id/", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const { description, status } = request.body;
  const updateTodo = `
    UPDATE
      todo
    SET 
      
      description ='${description}',
      status ='${status}'
    WHERE
    id='${id}';`;
  await db.run(updateTodo);
  response.send("todo updated successfully");
});

module.exports = app;
