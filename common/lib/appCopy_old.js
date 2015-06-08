var mysql = require("loopback-datasource-juggler").DataSource;

// console.log(mysql);

var	months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

var	connectionSettings = {
	host : "192.168.1.2",
	user : "root",
	password : "grip@123",
	database : "nodetest"
};

var	connection = function(){
	var dataSource = new mysql("mysql",connectionSettings);
	// console.log(dataSource);
	return dataSource;
}

var	initApp = function(cb) {
	connection().connect(function(err){
		connectionOnConnect(err,function(data){
			cb && cb(data);
		});
	});
}

var	connectionOnConnect = function(err,cb){
	if(err){
		throw new Error(err);
	}else{

		connection().connector.query("SELECT CAST(bill_createddate as DATE) AS bill_createddate,bill_totalpayment FROM nodetest.testbilling ORDER BY bill_createddate ASC LIMIT 300000;"
			,function(error,results,fields){
				connectionOnQuery(error,results,fields,function(data){
					cb && cb(data);
				});
			});
	}
}

var	connectionOnQuery = function(error,results,fields,cb){
	var billDimensions = calculateBillDimensions(results);
	var _res = {
		error : error,
		results : results,
		fields : fields,
		billDimensions : billDimensions
	};
	cb && cb(_res);
	return _res;
}

var	calculateBillDimensions = function(results,cb){
	var totalBills = 0,totalAmount = 0,currMonth = 0,prevMonth = 0, retResArr = [], retResProp = {};
	for (var i = 0; i < results.length; i++) {

		//handle dates passed from api, which get stringified
		if(typeof results[i].bill_createddate === "string"){
			results[i].bill_createddate = new Date(Date.parse(results[i].bill_createddate));
		}
		currMonth = results[i].bill_createddate.getMonth();
		if(prevMonth === currMonth){
			totalAmount = totalAmount + (results[i].bill_totalpayment || 0);
			totalBills = totalBills + 1;
		}else{
			retResProp["month"] = months[prevMonth];
			retResProp["totalBills"] = totalBills;
			retResProp["totalAmount"] = totalAmount;
			retResProp["average"] = totalAmount / totalBills;

			retResArr.push(retResProp);

			retResProp = {};

			prevMonth = currMonth;
			totalAmount = 0;
			totalBills= 0;

			totalAmount = totalAmount + (results[i].bill_totalpayment || 0);
			totalBills = totalBills + 1;
		}
	};
	retResProp["month"] = months[currMonth];
	retResProp["totalBills"] = totalBills;
	retResProp["totalAmount"] = totalAmount;
	retResProp["average"] = totalAmount / totalBills;

	retResArr.push(retResProp);
	retResProp = {};

	cb && cb(retResArr);
	return retResArr;
}

var	getHighestMonthOfYear = function (results,cb){
	var highestMonthOfYear = 0,highestMonthOfYearValue = 0;
	var totalAmount = 0, currMonth = 0, prevMonth = 0;
	
	//handle dates passed from api, which get stringified
	if(typeof results[0].bill_createddate === "string"){
		results[0].bill_createddate = new Date(Date.parse(results[0].bill_createddate));
	}
	prevMonth = results.length > 0 && results[0].bill_createddate.getMonth();
	
	for (var i = 0; i < results.length; i++) {
		//handle dates passed from api, which get stringified
		if(typeof results[i].bill_createddate === "string"){
			results[i].bill_createddate = new Date(Date.parse(results[i].bill_createddate));
		}
		currMonth = results[i].bill_createddate.getMonth();

		if(prevMonth === currMonth){
			totalAmount = totalAmount + (results[i].bill_totalpayment || 0);
		}else{
			highestMonthOfYear = totalAmount > highestMonthOfYearValue ? prevMonth : highestMonthOfYear;
			highestMonthOfYearValue = totalAmount > highestMonthOfYearValue ? totalAmount : highestMonthOfYearValue;

			prevMonth = currMonth;
			totalAmount = (results[i].bill_totalpayment || 0);
		}
	}

	//to display last month of december
	highestMonthOfYear = totalAmount > highestMonthOfYearValue ? currMonth : highestMonthOfYear;
	highestMonthOfYearValue = totalAmount > highestMonthOfYearValue ? totalAmount : highestMonthOfYearValue;
	
	cb && cb(highestMonthOfYear, highestMonthOfYearValue);

	return {
		highestMonthOfYear : highestMonthOfYear,
		highestMonthOfYearValue : highestMonthOfYearValue
	};
}

var	getLowestMonthOfYear = function (results,cb){
	var lowestMonthOfYear = 99999999999999999,lowestMonthOfYearValue = 99999999999999999;
	var totalAmount = 0,currMonth = 0,prevMonth = 0;
	
	//handle dates passed from api, which get stringified
	if(typeof results[0].bill_createddate === "string"){
		results[0].bill_createddate = new Date(Date.parse(results[0].bill_createddate));
	}
	prevMonth = results.length > 0 && results[0].bill_createddate.getMonth();
	
	for (var i = 0; i < results.length; i++) {
		//handle dates passed from api, which get stringified
		if(typeof results[i].bill_createddate === "string"){
			results[i].bill_createddate = new Date(Date.parse(results[i].bill_createddate));
		}

		currMonth = results[i].bill_createddate.getMonth();
		if(prevMonth === currMonth){
			totalAmount = totalAmount + (results[i].bill_totalpayment || 0);
		}else{
			lowestMonthOfYear = totalAmount < lowestMonthOfYearValue ? prevMonth : lowestMonthOfYear;
			lowestMonthOfYearValue = totalAmount < lowestMonthOfYearValue ? totalAmount : lowestMonthOfYearValue;
			
			prevMonth = currMonth;
			totalAmount = (results[i].bill_totalpayment || 0);
		}
	};
	//to display last month of december
	lowestMonthOfYear = totalAmount < lowestMonthOfYearValue ? currMonth : lowestMonthOfYear;
	lowestMonthOfYearValue = totalAmount < lowestMonthOfYearValue ? totalAmount : lowestMonthOfYearValue;
	
	cb && cb(lowestMonthOfYear, lowestMonthOfYearValue);

	return {
		lowestMonthOfYear : lowestMonthOfYear,
		lowestMonthOfYearValue : lowestMonthOfYearValue
	};
}

exports.multiply = function(num1,num2){
	return num1 * num2;
}


var testPerformanceMysql = function(cb){
	var msg = "";
	msg += "\nBEGIN performance test for mysql " + Date.now();
	console.log("BEGIN performance test for mysql " + Date.now());
	for (var i = 0; i < 100; i++) {
		(function(num){
			initApp(function(data){
				msg += "\nTime taken for iteration "+ num +" was " + Date.now()
				console.log("Time taken for iteration %s was %s",num,Date.now());
				if(num === 99){
					cb(msg);
				}
			});
		})(i);	
	}
	console.log("END performance test for mysql (async after for loop) " + Date.now());
	msg += "\nEND performance test for mysql (async after for loop) " + Date.now();
	
}

exports.months = months;
exports.initApp = initApp;
exports.connectionOnQuery = connectionOnQuery;
exports.calculateBillDimensions = calculateBillDimensions;
exports.getHighestMonthOfYear = getHighestMonthOfYear;
exports.getLowestMonthOfYear = getLowestMonthOfYear;
exports.testPerformanceMysql = testPerformanceMysql;