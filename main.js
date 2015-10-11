var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');
var Random = require('random-js');

function main()
{
	var args = process.argv.slice(2);

	if( args.length == 0 )
	{
		args = ["subject.js"];
	}
	var filePath = args[0];

	constraints(filePath);

	generateTestCases()

}

var engine = Random.engines.mt19937().autoSeed();

function createConcreteIntegerValue( greaterThan, constraintValue )
{
	if( greaterThan )
	return Random.integer(constraintValue,constraintValue+10)(engine);
	else
	return Random.integer(constraintValue-10,constraintValue)(engine);
}

function Constraint(properties)
{
	this.ident = properties.ident;
	this.expression = properties.expression;
	this.operator = properties.operator;
	this.value = properties.value;
	this.funcName = properties.funcName;
	// Supported kinds: "fileWithContent","fileExists"
	// integer, string, phoneNumber
	this.kind = properties.kind;
}

function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary =
{
	pathExists:
	{
		'path/fileExists': {}
	},
	fileWithContent:
	{
		pathContent:
		{
			file1: 'text content',
		}
	},
	fileWithNoContent:
	{
		pathContent:
		{
			file1: '',
		}
	},
	fileDoesNotExist:
	{
		pathContent:
		{
			file2: '',
		}
	}
};

function generateTestCases()
{

	var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');\n";
	for ( var funcName in functionConstraints )
	{
		var params = {};

		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			var paramName = functionConstraints[funcName].params[i];
			//params[paramName] = '\'' + faker.phone.phoneNumber()+'\'';
			params[paramName] = '\'\'';
		}

		console.log( params );

		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;
		// Handle global constraints...
		var fileWithContent = _.some(constraints, {kind: 'fileWithContent' });
		var pathExists      = _.some(constraints, {kind: 'fileExists' });
		var fileWithNoContent      = _.some(constraints, {kind: 'fileWithNoContent' });
		var fileDoesNotExist     = _.some(constraints, {kind: 'fileDoesNotExist' });
		var Phone_Input		 	= _.contains(functionConstraints[funcName].params, "phoneNumber");

		// plug-in values for parameters
		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				params[constraint.ident] = constraint.value;
			}

		//	if(Object.keys(params).length >1)
			{
				var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
				content += "subject.{0}({1});\n".format(funcName, args );
		//	}

		// Prepare function arguments.
		var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
}
		if( pathExists || fileWithContent )
		{
			content += generateMockFsTestCases(pathExists,fileWithContent,!fileDoesNotExists,funcName, args);
			// Bonus...generate constraint variations test cases....
			content += generateMockFsTestCases(!pathExists,!fileWithContent,!fileDoesNotExists,funcName, args);
			content += generateMockFsTestCases(pathExists,!fileWithContent,!fileDoesNotExists,funcName, args);
			content += generateMockFsTestCases(!pathExists,fileWithContent,!fileDoesNotExists,funcName, args);
			content += generateMockFsTestCases(!pathExists,fileWithContent,fileDoesNotExists,funcName, args);
			content += generateMockFsTestCases(pathExists,fileWithContent,fileDoesNotExists,funcName, args);
			content += generateMockFsTestCases(pathExists,!fileWithContent,fileDoesNotExists,funcName, args);

		}
		else if(Phone_Input)
		{
			if(Object.keys(params).length >1)
			{
				var Phone_Number ="1122122112";
				var Phone_Format ="(NNN) NNN-NNNN";
				var Options = "";
				content+= generatePhoneTestCases(Phone_Number,Phone_Format,Options,funcName);
				var Options = '{"normalize": true}';
				content+= generatePhoneTestCases(Phone_Number,Phone_Format,Options,funcName);
				var Options = '';

				content+= generatePhoneTestCases(faker.phone.phoneNumber(),faker.phone.phoneNumberFormat(),Options,funcName);
			}
			else
			{
				// Emit simple test case.
				content += "subject.{0}({1});\n".format(funcName, args );
			}
		}
		content += "subject.{0}({1});\n".format('blackListNumber', "'2121111111'");
	}
	fs.writeFileSync('test.js', content, "utf8");

}

function generatePhoneTestCases(Phone_Number,Phone_Format,Options,funcName)
{
	var args ='';
	if(Options == '')
	args="'"+Phone_Number+"','"+Phone_Format+"','"+Options+"'";
	else
	args="'"+Phone_Number+"','"+Phone_Format+"',"+Options;

	var testCase = '';
	testCase += "subject.{0}({1});\n".format(funcName, args );
	return testCase;
}

function generateMockFsTestCases (pathExists,fileWithContent,fileWithNoContent,fileDoesNotExist, funcName,args)
{
	var testCase = "";
	// Build mock file system based on constraints.
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }

		if(fileWithContent)
		{
			for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
		}
		else if(fileWithNoContent)
		{
			for (var attrname in mockFileLibrary.fileWithNoContent) { mergedFS[attrname] = mockFileLibrary.fileWithNoContent[attrname]; }
		}
		else if(fileDoesNotExist)
		{
			for (var attrname in mockFileLibrary.fileDoesNotExist) { mergedFS[attrname] = mockFileLibrary.fileDoesNotExist[attrname]; }
		}
	}
	testCase +=
	"mock(" +
	JSON.stringify(mergedFS)
	+
	");\n";

	testCase += "\tsubject.{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
	var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node)
	{
		if (node.type === 'FunctionDeclaration')
		{
			var funcName = functionName(node);
			console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{
				if( child.type === 'BinaryExpression' && child.operator == "==")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])

						functionConstraints[funcName].constraints.push(
							new Constraint(
								{
									ident: child.left.name,
									value: rightHand,
									funcName: funcName,
									kind: "integer",
									operator : child.operator,
									expression: expression
								}));
							}
						}

						if( child.type === 'BinaryExpression' && child.operator == "==")
						{
							if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
							{
								// get expression from original source code:
								var expression = buf.substring(child.range[0], child.range[1]);
								var rightHand = buf.substring(child.right.range[0], child.right.range[1])

								functionConstraints[funcName].constraints.push(
									new Constraint(
										{
											ident: child.left.name,
											value: parseInt(rightHand)+1,
											funcName: funcName,
											kind: "integer",
											operator : child.operator,
											expression: expression
										}));
									}
								}

								if( child.type === 'BinaryExpression' && child.operator == ">")
								{
									if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
									{
										// get expression from original source code:
										var expression = buf.substring(child.range[0], child.range[1]);
										var rightHand = buf.substring(child.right.range[0], child.right.range[1])

										functionConstraints[funcName].constraints.push(
											new Constraint(
												{
													ident: child.left.name,
													value: rightHand-1,
													funcName: funcName,
													kind: "integer",
													operator : child.operator,
													expression: expression
												}));
											}
										}
										if( child.type === 'BinaryExpression' && child.operator == ">")
										{
											if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
											{
												// get expression from original source code:
												var expression = buf.substring(child.range[0], child.range[1]);
												var rightHand = buf.substring(child.right.range[0], child.right.range[1])

												functionConstraints[funcName].constraints.push(
													new Constraint(
														{
															ident: child.left.name,
															value: parseInt(rightHand)+1,
															funcName: funcName,
															kind: "integer",
															operator : child.operator,
															expression: expression
														}));
													}
												}

												if( child.type === 'BinaryExpression' && child.operator == "<")
												{
													if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
													{
														// get expression from original source code:
														var expression = buf.substring(child.range[0], child.range[1]);
														var rightHand = buf.substring(child.right.range[0], child.right.range[1])

														functionConstraints[funcName].constraints.push(
															new Constraint(
																{
																	ident: child.left.name,
																	value: parseInt(rightHand)-1,
																	funcName: funcName,
																	kind: "integer",
																	operator : child.operator,
																	expression: expression
																}));
															}
														}
														if( child.type === 'BinaryExpression' && child.operator == "<")
														{
															if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
															{
																// get expression from original source code:
																var expression = buf.substring(child.range[0], child.range[1]);
																var rightHand = buf.substring(child.right.range[0], child.right.range[1])

																functionConstraints[funcName].constraints.push(
																	new Constraint(
																		{
																			ident: child.left.name,
																			value: parseInt(rightHand)+1,
																			funcName: funcName,
																			kind: "integer",
																			operator : child.operator,
																			expression: expression
																		}));
																	}
																}
																if( child.type == "CallExpression" &&
																child.callee.property &&
																child.callee.property.name =="readFileSync" )
																{
																	for( var p =0; p < params.length; p++ )
																	{
																		if( child.arguments[0].name == params[p] )
																		{
																			functionConstraints[funcName].constraints.push(
																				{
																					// A fake path to a file
																					ident: params[p],
																					value: "'pathContent/file1'",
																					mocking: 'fileWithContent'
																				});
																			}
																		}
																	}

																	if( child.type == "CallExpression" &&
																	child.callee.property &&
																	child.callee.property.name =="readFileSync" )
																	{
																		for( var p =0; p < params.length; p++ )
																		{
																			if( child.arguments[0].name == params[p] )
																			{
																				functionConstraints[funcName].constraints.push(
																					{
																						// A fake path to a file
																						ident: params[p],
																						value: "'pathContent/file1'",
																						mocking: 'fileWithNoContent'
																					});
																				}
																			}
																		}

																		if( child.type == "CallExpression" &&
																		child.callee.property &&
																		child.callee.property.name =="existsSync")
																		{
																			for( var p =0; p < params.length; p++ )
																			{
																				if( child.arguments[0].name == params[p] )
																				{
																					functionConstraints[funcName].constraints.push(
																						{
																							// A fake path to a file
																							ident: params[p],
																							value: "'path/fileExists'",
																							mocking: 'fileExists'
																						});
																					}
																				}
																			}

																		});

																		console.log( functionConstraints[funcName]);

																	}
																});
															}

															function traverse(object, visitor)
															{
																var key, child;

																visitor.call(null, object);
																for (key in object) {
																	if (object.hasOwnProperty(key)) {
																		child = object[key];
																		if (typeof child === 'object' && child !== null) {
																			traverse(child, visitor);
																		}
																	}
																}
															}

															function traverseWithCancel(object, visitor)
															{
																var key, child;

																if( visitor.call(null, object) )
																{
																	for (key in object) {
																		if (object.hasOwnProperty(key)) {
																			child = object[key];
																			if (typeof child === 'object' && child !== null) {
																				traverseWithCancel(child, visitor);
																			}
																		}
																	}
																}
															}

															function functionName( node )
															{
																if( node.id )
																{
																	return node.id.name;
																}
																return "";
															}


															if (!String.prototype.format) {
																String.prototype.format = function() {
																	var args = arguments;
																	return this.replace(/{(\d+)}/g, function(match, number) {
																		return typeof args[number] != 'undefined'
																		? args[number]
																		: match
																		;
																	});
																};
															}

															main();
