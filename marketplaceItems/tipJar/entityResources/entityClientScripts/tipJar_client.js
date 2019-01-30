/*

    Tip Jar!
    tipJar_client.js
    Created by Milad Nazeri on 2019-01-15
    Copyright 2019 High Fidelity, Inc.

    Distributed under the Apache License, Version 2.0.
    See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html

    Simple customizable client only tip jar

*/


(function() {

    // *************************************
    // START INIT
    // *************************************
    // #region INIT


    var request = Script.require('../modules/request.js').request;
        

    // #endregion
    // *************************************
    // END INIT
    // *************************************

    // *************************************
    // START MONEY
    // *************************************
    // #region MONEY
    
    var METAVERSE_BASE = Account.metaverseServerURL;
    var BALANCE_URL = METAVERSE_BASE + '/api/v1/commerce/balance';

    // Options request uses
    var options = {};
    options.uri = BALANCE_URL;
    options.method = "POST";


    // Before the user pays, check to see what their current balance is
    var running = false;
    function getFirstBalance() {
        running = true;
        request(options, getFirstBalanceCallBack);
    }


    // When we have the first balance, we initiate getting the second balance
    function getSecondBalance() {
        request(options, getSecondBalanceCallBack);
    }


    // Callback that is run after we request the first balance
    var TIME_TILL_SECOND_BALANCE_CHECK_TIMEOUT_MS = 2500;
    var MAXIMUM_FIRST_BALANCE_RETRIES = 5;
    var FIRST_BALANCE_CHECK_INTERVAL = 250;
    var firstBalanceRetryCount = 0;
    var firstBalance = null;
    function getFirstBalanceCallBack(error, result) {
        // The user clicked during some part of the balance process
        if (abortCurrentRunningProcess){
            resetBalanceChecks();
            return;
        }

        // We didn't get the first balance so gracefully move on to the QML window and just ignore the feedback
        // As the user will get feedback already from the default sendTip process
        if (firstBalanceRetryCount >= MAXIMUM_FIRST_BALANCE_RETRIES) {
            running = false;
            sendTip(hfcAmount, destinationName, message);
            return;
        }

        // There was an error of some kind so retry. 
        if (error || result.status !== "success"){
            firstBalanceRetryCount++;
            Script.setTimeout(function(){
                request(options, getFirstBalanceCallBack);
            }, FIRST_BALANCE_CHECK_INTERVAL);
            return;
        }

        // We got the balance so call the commerce api and start calling for the second balance
        firstBalance = result.data.balance;
        firstBalanceRetryCount = 0;
        sendTip(hfcAmount, destinationName, message);
        Script.setTimeout(function(){
            if (abortCurrentRunningProcess){
                resetBalanceChecks();
                return;
            }
            getSecondBalance();
        }, TIME_TILL_SECOND_BALANCE_CHECK_TIMEOUT_MS);
    }


    // Called after we got the first balance to see if the tip went through
    var MAXIMUM_SECOND_BALANCE_RETRIES = 7;
    var SECOND_BALANCE_CHECK_INTERVAL = 1000;
    var secondBalanceRetryCount = 0;
    var secondBalance = null;
    function getSecondBalanceCallBack(error, result) {
        // The user clicked during some part of the balance process
        if (abortCurrentRunningProcess){
            resetBalanceChecks();
            return;
        }

        // We have hit the maximum amount of tries so return and reset balance related data
        if (secondBalanceRetryCount >= MAXIMUM_SECOND_BALANCE_RETRIES) {
            running = false;
            resetBalanceChecks();
            return;
        }

        // There was an error fetching, retry
        if (error || result.status !== "success"){
            secondBalanceRetryCount++;
            Script.setTimeout(function(){
                request(options, getSecondBalanceCallBack);
            }, SECOND_BALANCE_CHECK_INTERVAL);
            return;
        }

        // The balance has gone through correctly.  Reset ur balance data and start feedback animation.
        secondBalance = result.data.balance;
        if (didThePaymentGoThrough()) {
            running = false;
            resetBalanceChecks();
            startFeedback();
            return;
        }

        // Second balance isn't the right amount, trying again
        secondBalanceRetryCount++;
        Script.setTimeout(function(){
            request(options, getSecondBalanceCallBack);
        }, SECOND_BALANCE_CHECK_INTERVAL);
    }


    // Check to see if the payment went through by examining the two balances
    function didThePaymentGoThrough(){
        var targetBalance = firstBalance - hfcAmount;
        return secondBalance === targetBalance;
    }


    // Easy reset for the balance checks
    function resetBalanceChecks(){
        firstBalanceRetryCount = 0;
        secondBalanceRetryCount = 0;
        firstBalance = null;
        secondBalance = null;
        abortCurrentRunningProcess = false;
    }


    // This function will open a user's tablet and prompt them to pay for VIP status.
    var tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
    function sendTip(hfcAmount, destinationName, message) {
        tablet.loadQMLSource("hifi/commerce/common/sendAsset/SendAsset.qml");
        tablet.sendToQml({
            method: 'updateSendAssetQML',
            assetCertID: "",
            amount: hfcAmount,
            username: destinationName,
            message: message
        });
    }

    
    // #endregion
    // *************************************
    // END MONEY
    // *************************************

    // *************************************
    // START ANIMATION
    // *************************************
    // #region ANIMATION
    
    
    // Play a local sound and return the audioinjector
    var audioOptions = {
        volume: 1.0,
        localOnly: true
    };
    function playAudio(sound){
        var position = Entities.getEntityProperties(_entityID, 'position').position;
        audioOptions.position = position;
        return Audio.playSound(sound, audioOptions);
    }
    

    // As of V78, there are some issues with FBX animation playback.  Deleting the overlay and recreating again works very well though for a seamless experience
    function stopAnimation(){
        Overlays.deleteOverlay(tipJar);
        createTipJarOverlay();
    }

    
    // Play the overlay animation and then delete it
    var ANIMATION_STOP_TIMEOUT_MS = 2300;
    var ANIMATION_URL = Script.resolvePath('../resources/models/tipJar_Anim.fbx');
    var newOverlayProperties = {
        animationSettings: {
            url: ANIMATION_URL,
            running: true,
            firstFrame: 0,
            lastFrame: 70,
            currentFrame: 0,
            allowTranslation: true,
            fps: 30
        }
    };
    function playAnimation(){
        Overlays.editOverlay(tipJar, newOverlayProperties);
        Script.setTimeout(stopAnimation, ANIMATION_STOP_TIMEOUT_MS);
    }


    // Start both the animation and play the sound when the coin drops into the money
    var TIMEOUT_FOR_COIN_DROP_AUDIO = 2000;
    var coinInjector = null;
    function startFeedback(){
        playAnimation();
        Script.setTimeout(function(){
            coinInjector = playAudio(coinSound);
        }, TIMEOUT_FOR_COIN_DROP_AUDIO);
    }
    
    
    // #endregion
    // *************************************
    // END ANIMATION
    // *************************************

    // *************************************
    // START OVERLAY
    // *************************************
    // #region OVERLAY
    
    
    // Create the model overlay where the box is
    var tipJar = null;
    var tipJarModel = Script.resolvePath("../resources/models/tipJar_Anim.fbx");
    var tipJarProps = {
        name: "tipjar",
        dimensions: {
            x: 0.57060835361480713,
            y: 0.6698657631874084,
            z: 0.47296142578125
        },
        url: tipJarModel,
        visible: true
    };
    function createTipJarOverlay() {
        var currentPosition = Entities.getEntityProperties(_entityID, "position").position;
        tipJarProps.parentID = _entityID;
        tipJarProps.position = currentPosition;
        tipJar = Overlays.addOverlay("model", tipJarProps);
    }
    
    
    // #endregion
    // *************************************
    // END OVERLAY
    // *************************************

    // *************************************
    // START USER_DATA
    // *************************************
    // #region USER_DATA
    
    
    // Checks to see if the userData is unique
    function isNewUserDataDifferent(oldUserData, newUserData){
        oldUserData = typeof oldUserData === "string" ? oldUserData : JSON.stringify(oldUserData);
        newUserData = typeof newUserData === "string" ? newUserData : JSON.stringify(newUserData);
        if (oldUserData === newUserData){
            return false;
        }

        return true;
    }


    // Get the latest userData before initiating payment
    var MAX_HFC_TIP_ALLOWED = 1000000;
    var userData = {};
    var previousUserData = {};
    var destinationName = null;
    var hfcAmount = 0;
    var message = "";
    function getLatestUserData(){
        var newUserData = Entities.getEntityProperties(_entityID, 'userData').userData;
        if (isNewUserDataDifferent(previousUserData, newUserData)){
            previousUserData = "name" in userData ? userData : newUserData;
            userData = JSON.parse(newUserData);

            // In case someone puts something strange in for the number
            if (typeof userData.hfcAmount !== "number") {
                userData.hfcAmount = 1;
            }

            // hfc shows on inventory that it gets rounded, so go ahead and round the amount to clear up any confusion
            hfcAmount = Math.min(Math.round(userData.hfcAmount), MAX_HFC_TIP_ALLOWED);
            destinationName = userData.destinationName;
            message = userData.message;
        }
    }

    
    // #endregion
    // *************************************
    // END USER_DATA
    // *************************************

    // *************************************
    // START ENTITY DEFINITION
    // *************************************
    // #region ENTITY DEFINITION
    

    // Grab the entityID on preload
    var COIN_SOUND_URL = Script.resolvePath('../resources/sounds/CoinsDrop_BW.6645_1497719.4.R.wav');
    var CLICK_SOUND_URL = Script.resolvePath('../resources/sounds/beep.mp3');
    var _entityID = null;
    var coinSound = null;
    var clickSound = null;
    function preload(entityID) {
        _entityID = entityID;
        coinSound = SoundCache.getSound(COIN_SOUND_URL);
        clickSound = SoundCache.getSound(CLICK_SOUND_URL);
        createTipJarOverlay();
        getLatestUserData();
    }


    // Main user interaction handler
    var clickInjector = null;
    var abortCurrentRunningProcess = false;
    var ABORT_TIMEOUT_MS = 1000;
    function userClicked() {
        clickInjector = playAudio(clickSound);
        getLatestUserData();
        if (running){
            abortCurrentRunningProcess = true;
            // Give a little time for the other calls to clear before proceding.
            Script.setTimeout(function(){
                getFirstBalance();
            }, ABORT_TIMEOUT_MS);
            return;
        }
        getFirstBalance();
    }


    // Handle if mouse pressed down on entity
    function clickDownOnEntity(id, event) {
        if (event.button === "Primary") {
            userClicked();
        }
    }

    
    // Handle near triggered on entity
    function startNearTrigger() {
        userClicked();
    }


    // Handle if far triggered on entity
    function startFarTrigger() {
        userClicked();
    }

    
    // Cleans up anything outstanding upon entity closing
    function unload() {
        Overlays.deleteOverlay(tipJar);
    }


    function TipJar() {}
    
    TipJar.prototype = {
        preload: preload,
        clickDownOnEntity: clickDownOnEntity,
        startNearTrigger: startNearTrigger,
        startFarTrigger: startFarTrigger,
        unload: unload
    };

    return new TipJar();
    

    // #endregion
    // *************************************
    // END ENTITY DEFINITION
    // *************************************

});
