var exports = module.exports;
var https = require('https');

//key-value pair list that contains information about UK Government Benefits
var BENEFITS = {
    "Tax Credit": "Tax Credit",
    "Housing Benefit": "Housing Benefit",
    "Child Benefit": "Child Benefit",
    "Disability Living Allowance": "Disability Living Allowance",
    "Income Support": "Income Support",
    "Incapacity Benefit": "Incapacity Benefits",
    "Jobseakers Allowance": "Jobseakers Allowance",
    "Council Tax Benefit": "Council Tax Benefit"
};

//function to iterate over an array and concatenate each element
function getArrayAsList(array) {
    var i = 1;
    var length = array.length;
    var tempOutput = "";
    for (var key in array) {
        if (i === length) {
            tempOutput += "and ";
        }
        tempOutput += key + ", ";
        i++;
    }
    return tempOutput;
};

//static ID of the Alexa Skills App we are working with
var APP_ID = "amzn1.ask.skill.f99c9eb0-e7da-4180-b453-552afd40454f";

//staged information about what the AIE is
var TAX_INFORMATION = ["What tax are you interested in knowing more about",
    "I can tell you about your income tax, your value added tax"
];


// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */

        if (event.session.application.applicationId !== APP_ID) {
            context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({ requestId: event.request.requestId }, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
        ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
        ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
        ", sessionId=" + session.sessionId);
    var intent = intentRequest.intent;
    // Handle intent request
    handleIntentRequest(intent, session, callback);
}

function handleIntentRequest(intent, session, callback) {
    console.log("handleIntentRequest" + intent.name);
    //Initalisation of variables
    var speechOutput = "";
    var repromptText = "";
    var area = "";
    var shouldEndSession = false;
    var sessionAttributes = {};
    // Checks whether the session variable has already been initalised
    var stage = 0;
    if (session.attributes) {
        stage = session.attributes.stage;
    }
    var slots = "";
    if (intent.slots) {
        slots = intent.slots;
    }
    var intentName = intent.name;
    //Filters the name of the intent
    switch (intentName) {
        // Get information about Taxes
        case "Taxes":
            var responseTaxInformation = getTaxInformation(stage, shouldEndSession);
            stage = responseTaxInformation.stage;
            speechOutput = responseTaxInformation.speechOutput;
            shouldEndSession = responseTaxInformation.shouldEndSession;
            break;
        // Get information about Income Taxes
        case "IncomeTax":
            var responseIncomeTaxInformation = getIncomeTaxInformation(stage, shouldEndSession);
            stage = responseIncomeTaxInformation.stage;
            speechOutput = responseIncomeTaxInformation.speechOutput;
            shouldEndSession = responseIncomeTaxInformation.shouldEndSession;
            break;
        // Get the list of Benefits
        case "Benefits":
            speechOutput = getBenefitInformation();
            break;
        //  mrj todo - Search gov.uk for string
        case "SearchGovUK":
            //speechOutput = 
            break;
        case "CarTax":
            speechOutput = "I Can't drive";
            // speechOutput = getCarTaxInformation();
            break;
        case "DrivingLicense":
            speechOutput = "Please tell me your drivers license number. It's item 5 on your drivers license"
            break;
        case "Passport":
            speechOutput = "Please tell me your drivers license number. It's item 5 on your drivers license"
            break;
        case "AMAZON.YesIntent":
            if (stage) {
                // if the user has triggered a staging process where they need to step into the next item in the list
                intent.name = session.attributes.lastIntent;
                handleIntentRequest(intent, session, callback);
            }
            break;
        case "AMAZON.NoIntent":
            //ends session no matter the stage of the conversation
            handleSessionEndRequest(callback);
            break;
        case "AMAZON.RepeatIntent":
            if (session.attributes) {
                //sets intentName and last response to the values stored in the session variables
                intentName = session.attributes.lastIntent;
                var lastResponse = session.attributes.lastResponse;
                if (lastResponse) {
                    speechOutput = lastResponse;
                } else {
                    speechOutput = "Say what again? You haven't asked me a question";
                }
            }
            break;
        case "AMAZON.StopIntent":
            handleSessionEndRequest(callback);
            break;
        default:
            //default search to the FAQ list
            speechOutput = AIE_FAQS[intentName];
            shouldEndSession = true;
    }
    //prepares session variables for storage
    sessionAttributes["stage"] = stage;
    sessionAttributes["lastResponse"] = speechOutput;
    sessionAttributes["lastIntent"] = intentName;

    if (area) {
        sessionAttributes["area"] = area;
    }
    //if the speech output was not filled, meaning the intent was not understood, give a meaningful response and end the session
    if (!speechOutput) {
        //if the location sent was not in the location list
        speechOutput = "Sorry, I don't understand what you asked";
        shouldEndSession = true;
    }

    //creates callback response
    callback(sessionAttributes,
        buildSpeechletResponse(intentName, speechOutput, repromptText, shouldEndSession));
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
        ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}


// --------------- Functions that control the skill's behavior -----------------------
function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Welcome to UK Government." +
        "<break time=\"0.5s\" /> You can ask me lots of questions about the services we provide" +
        "<break time=\"0.5s\" /> You can ask me about tax, benefits, driving licenses, passports" +
        "<break time=\"0.5s\" /> What would you like to know about";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "";
    var shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    var cardTitle = "Session Ended";
    var speechOutput = "Thanks for listening";
    // Setting this to true ends the session and exits the skill.
    var shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

// --------------- Helpers that build all of the responses -----------------------
function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    //replaces commonly used acronyms with the SSML equivalent for better pronouciation
    return {
        outputSpeech: {
            "type": "SSML",
            //encapsulates the output within SSML speak tags
            "ssml": "<speak>" + output + "</speak>"
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}


// ----------------------- TODO -------------------------
function getBenefitInformation() {
    return "The UK Government provides: " + getArrayAsList(BENEFITS)
        + "<break time=\"0.5s\" /> what benefit would you like to know more about";
};

function callApi(url, eventCallback) {
    https.get(url, function (res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            //var stringResult = parseJson(body);
            eventCallback(body);
        });
    }).on('error', function (e) {
        console.log("Got error: ", e);
    });
}

function searchGovUK(searchQuery, eventCallback) {
    var url = 'https://www.gov.uk/api/search.json?q=' + searchQuery;

    https.get(url, function (res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            //var stringResult = parseJson(body);
            eventCallback(body);
        });
    }).on('error', function (e) {
        console.log("Got error: ", e);
    });
}

function getCarTaxInformation(stage, shouldEndSession) {
    var vehicleReg = slots.registration.value;
    var response = {}, taxStatus;
    response.shouldEndSession = shouldEndSession;
    response.speechOutput = '';
    response.stage = stage;
    if(vehicleReg){
        callApi('https://dvlasearch.appspot.com/DvlaSearch?apikey={}&licencePlate='+vehicleReg, function(res) {
            if (!res){
            response.speechOutput = "I'm sorry, I have no information"; 
            } else {
                if(res.taxStatus ==="Tax not due"){
                    var taxDue = res.taxDetails.split(': ');
                    taxStatus ='not due until '+taxDue[1];
                } else{
                    taxStatus='due now';
                }
                response.speechOutput = "the tax on your "+res.make+" is "+taxStatus;
                return response.speechOutput;
            }
        })
    } else{
        response.speechOutput="I'm sorry, you didn't provide me with a vehicle registration number";
    }
    return response;
};

function getTaxInformation(stage, shouldEndSession) {
    var response = {};
    response.shouldEndSession = shouldEndSession;
    response.speechOutput = '';
    response.stage = stage;

    //if the iteration has reached the end of the array's length
    if (stage === TAX_INFORMATION.length) {
        response.speechOutput = "I'm sorry, I have no more information";
        response.shouldEndSession = true;
    } else {
        response.speechOutput = (TAX_INFORMATION[stage] + "<break time=\"0.5s\"/> would you like me to go on?");
        response.stage++;
    }

    return response;
};

function getIncomeTaxInformation(stage, shouldEndSession) {
    var response = {};
    response.shouldEndSession = shouldEndSession;
    response.speechOutput = '';
    response.stage = stage;

    //if the iteration has reached the end of the array's length
    if (stage === TAX_INFORMATION.length) {
        response.speechOutput = "I'm sorry, I have no more information";
        response.shouldEndSession = true;
    } else {
        response.speechOutput = (TAX_INFORMATION[stage] + "<break time=\"0.5s\"/> would you like me to go on?");
        response.stage++;
    }

    return response;
};