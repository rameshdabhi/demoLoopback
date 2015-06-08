var mysql = require('loopback-datasource-juggler').DataSource;
var redis = require('redis');
var client = redis.createClient(); //creates a new client 



var clearCache = function(key){
	client.exists(key,function  (e,r) {
    	console.log(key,'exists',e,r);
    	if(r === 1){
			client.del(key,function (e1,r1) {
				console.log(key,'del',e1,r1);
			});
    	}
    });
};

client.on('connect', function() {
    console.log('redis connected');
    clearCache('alldata');
    clearCache('pivotdata');
});

var	months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

var	connectionSettings = {
	host : '192.168.1.2',
	user : 'root',
	password : 'grip@123',
	database : 'nodetest'
};

var	connection = function(){
	var dataSource = new mysql('mysql',connectionSettings);
	// console.log(dataSource);
	return dataSource;
};

var	initApp = function(cb) {
	connection().connect(function(err){
		var bd,ad;
		bd = Date.now();
		console.log('initApp before data %s', bd);
		connectionOnConnect(err,function(data){
			ad = Date.now();
			console.log('initApp after data %s', ad);
			console.log('initApp total time for data %s ms',ad - bd);
			// console.log(data);
			cb && cb(data);
			return data;
		});
	});
};

var	connectionOnConnect = function(err,cb){

	if(err){
		throw new Error(err);
	}else{
		//check if already in cache 
		client.exists('alldata',function (he_err,he_reply) {
			if(he_err) throw new Error(he_err);
			console.log('alldata exists? : %s',!!he_reply);
			if(he_reply === 1){
				client.hgetall('alldata',function (err,obj) {
					connectionOnQuery(JSON.parse(obj['error']),JSON.parse(obj['results']),JSON.parse(obj['fields']),function(data){
						cb && cb(data);
						return data;
					});
				});
			}
			//else get from db
			else{
				connection().connector.query('SELECT CAST(bill_createddate as DATE) AS bill_createddate,bill_totalpayment FROM nodetest.testbilling ORDER BY bill_createddate ASC LIMIT 100000;'
					,function(error,results,fields){
						// client.hmset('alldata', {
						// 	'error': 'error',
						// 	'results': 'results',
						// 	'fields': 'fields'
						// });
 
						client.hmset('alldata','error', JSON.stringify(error || ''));
						client.hmset('alldata','results', JSON.stringify(results));
						client.hmset('alldata','fields', JSON.stringify(fields || ''));

						// client.hmget('alldata','results',function (e,r) {
						// 	console.log(e,r);
						// });
						client.hgetall('alldata',function (err,obj) {
							connectionOnQuery(JSON.parse(obj['error']),JSON.parse(obj['results']),JSON.parse(obj['fields']),function(data){
								cb && cb(data);
								return data;
							});
						});
				});
			}
		});
	}
};

var	connectionOnQuery = function(error,results,fields,cb){
	// var billDimensions = calculateBillDimensions(results);
	calculateBillDimensions(results,function (billDimensions) {
		var _res = {
			error : error,
			results : results,
			fields : fields,
			billDimensions : billDimensions
		};
		cb && cb(_res);
		return _res;
	});
};

var	calculateBillDimensions = function(results,cb){
	var retResArr = [];
	var bd =Date.now(),ad;
	console.log('calculateBillDimensions before pivot %s',bd);
	client.exists('pivotdata',function (e_err,e_reply) {
		if(e_err) throw new Error(e_err);
		console.log('pivotdata exists? : %s',!!e_reply);
		if(e_reply === 1){
			client.get('pivotdata',function (err,obj) {
				ad = Date.now();
				console.log('calculateBillDimensions after %s',ad);
				console.log('calculateBillDimensions total time for pivoting data %s ms',ad - bd);
				cb && cb(JSON.parse(obj));
				return JSON.parse(obj);
			});
		}
		//else get from db
		else{
			var totalBills = 0,totalAmount = 0,currMonth = 0,prevMonth = 0, retResProp = {};
			for (var i = 0; i < results.length; i++) {

				//handle dates passed from api, which get stringified
				if(typeof results[i].bill_createddate === 'string'){
					results[i].bill_createddate = new Date(Date.parse(results[i].bill_createddate));
				}
				currMonth = results[i].bill_createddate.getMonth();
				if(prevMonth === currMonth){
					totalAmount = totalAmount + (results[i].bill_totalpayment || 0);
					totalBills = totalBills + 1;
				}else{
					retResProp['month'] = months[prevMonth];
					retResProp['totalBills'] = totalBills;
					retResProp['totalAmount'] = totalAmount;
					retResProp['average'] = totalAmount / totalBills;

					retResArr.push(retResProp);

					retResProp = {};

					prevMonth = currMonth;
					totalAmount = 0;
					totalBills= 0;

					totalAmount = totalAmount + (results[i].bill_totalpayment || 0);
					totalBills = totalBills + 1;
				}
			};
			retResProp['month'] = months[currMonth];
			retResProp['totalBills'] = totalBills;
			retResProp['totalAmount'] = totalAmount;
			retResProp['average'] = totalAmount / totalBills;

			retResArr.push(retResProp);
			retResProp = {};

			client.set('pivotdata',JSON.stringify(retResArr),function(s_e,s_r){
				console.log('pivotdata set',s_e,s_r);
			});

			ad = Date.now();
			console.log('calculateBillDimensions after %s',ad);
			console.log('calculateBillDimensions total time for pivoting data %s ms',ad - bd);

			cb && cb(retResArr);

			return retResArr;
		}	
	});
};

var	getHighestMonthOfYear = function (results,cb){
	var highestMonthOfYear = 0,highestMonthOfYearValue = 0;
	var totalAmount = 0, currMonth = 0, prevMonth = 0;
	
	//handle dates passed from api, which get stringified
	if(typeof results[0].bill_createddate === 'string'){
		results[0].bill_createddate = new Date(Date.parse(results[0].bill_createddate));
	}
	prevMonth = results.length > 0 && results[0].bill_createddate.getMonth();
	
	for (var i = 0; i < results.length; i++) {
		//handle dates passed from api, which get stringified
		if(typeof results[i].bill_createddate === 'string'){
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
	
	// cb && cb(highestMonthOfYear, highestMonthOfYearValue);
	cb && cb({
		highestMonthOfYear : highestMonthOfYear,
		highestMonthOfYearValue : highestMonthOfYearValue
	});

	return {
		highestMonthOfYear : highestMonthOfYear,
		highestMonthOfYearValue : highestMonthOfYearValue
	};
};

var	getLowestMonthOfYear = function (results,cb){
	var lowestMonthOfYear = 99999999999999999,lowestMonthOfYearValue = 99999999999999999;
	var totalAmount = 0,currMonth = 0,prevMonth = 0;
	
	//handle dates passed from api, which get stringified
	if(typeof results[0].bill_createddate === 'string'){
		results[0].bill_createddate = new Date(Date.parse(results[0].bill_createddate));
	}
	prevMonth = results.length > 0 && results[0].bill_createddate.getMonth();
	
	for (var i = 0; i < results.length; i++) {
		//handle dates passed from api, which get stringified
		if(typeof results[i].bill_createddate === 'string'){
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
	
	// cb && cb(lowestMonthOfYear, lowestMonthOfYearValue);
	cb && cb({
		lowestMonthOfYear : lowestMonthOfYear,
		lowestMonthOfYearValue : lowestMonthOfYearValue
	});

	return {
		lowestMonthOfYear : lowestMonthOfYear,
		lowestMonthOfYearValue : lowestMonthOfYearValue
	};
};

exports.multiply = function(num1,num2){
	return num1 * num2;
};


var testPerformanceMysql = function(cb){
	var msg = '';
	msg += '\nBEGIN performance test for mysql ' + Date.now();
	console.log('BEGIN performance test for mysql ' + Date.now());
	for (var i = 0; i < 100; i++) {
		(function(num){
			initApp(function(data){
				msg += '\nTime taken for iteration '+ num +' was ' + Date.now()
				console.log('Time taken for iteration %s was %s',num,Date.now());
				if(num === 99){
					cb(msg);
				}
			});
		})(i);	
	}
	console.log('END performance test for mysql (async after for loop) ' + Date.now());
	msg += '\nEND performance test for mysql (async after for loop) ' + Date.now();
	
};

exports.months = months;
exports.initApp = initApp;
exports.connectionOnQuery = connectionOnQuery;
exports.calculateBillDimensions = calculateBillDimensions;
exports.getHighestMonthOfYear = getHighestMonthOfYear;
exports.getLowestMonthOfYear = getLowestMonthOfYear;
exports.testPerformanceMysql = testPerformanceMysql;
exports.redis = redis;
exports.redis_client = client;
exports.clearCache = clearCache;