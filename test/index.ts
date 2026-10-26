import express from "express"
const app = express();

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.post("/test",(req,res)=>{
    console.log(req.body)
    res.json({"status":200,"message":"lol"})
})
// Start the server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});