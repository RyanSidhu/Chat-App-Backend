var express = require("express")
var cors = require("cors")
var bodyParser = require("body-parser")
var app = express()
var port = process.env.PORT || 5001
var fs = require('fs');
var http = require('http');
var https = require('https');
var privateKey  = fs.readFileSync('./ssl/ryansidhu.key', 'utf8');
var certificate = fs.readFileSync('./ssl/ryansidhu.cert', 'utf8');
var credentials = {key: privateKey, cert: certificate};




app.use(bodyParser.json())
app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))

var Backend = require("./routes/Backend")
//var FileUpload = require("./routes/FileUpload")

app.use("/api", Backend)
//app.use("/fileupload", FileUpload)
var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(1048, function() {
    console.log('Http Server running on port 6048');
});
httpsServer.listen(port, function() {
    console.log('HTTPS Server is running on port ' + port);
});


