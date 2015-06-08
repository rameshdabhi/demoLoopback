module.exports = function(app){
	// Install a "/ping" route that returns "pong"
	app.get("/ping",function(req,res){
		res.send("pong");
	});

	var router = app.loopback.Router();
	router.get("/ping2",function(req,res) {
		res.send("pong2");
	});
	app.use(router);
}