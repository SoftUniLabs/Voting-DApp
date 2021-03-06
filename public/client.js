$(document).ready(function () {
    const ethereumProvider = ethers.providers.getDefaultProvider('ropsten');
    
    // The data for the contract (Address and ABI)
    const votingContractAddress = "0x8f16113c7cd6fdfd5b14f39697f10dc4f86a410f";
    const votingContractABI = [
        {
            "constant": true,
            "inputs": [{"name": "index", "type": "uint32"}],
            "name": "getCandidate",
            "outputs": [{"name": "", "type": "string"}],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "candidatesCount",
            "outputs": [{"name": "", "type": "uint32"}],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [{"name": "name", "type": "string"}],
            "name": "addCandidate",
            "outputs": [],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "constant": false,
            "inputs": [{"name": "index", "type": "uint32"}],
            "name": "vote",
            "outputs": [],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [{"name": "index", "type": "uint32"}],
            "name": "getVotes",
            "outputs": [{"name": "", "type": "uint32"}],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
        }
    ];

    //Make instance of the contract
    const votingContract = new ethers.Contract(
        votingContractAddress, votingContractABI, ethereumProvider);

    showView("viewHome");

    $('#linkHome').click(function () {
        showView("viewHome");
    });

    $('#linkLogin').click(function () {
        showView("viewLogin");
    });

    $('#linkRegister').click(function () {
        showView("viewRegister");
    });

    $('#linkLogout').click(logout);

    $('#buttonLogin').click(login);
    $('#buttonRegister').click(register);

    function showView(viewName) {
        // Hide all views and show the selected view only
        $('main > section').hide();
        $('#' + viewName).show();
        
        const loggedIn = sessionStorage.jsonWallet;
        
        if (loggedIn) {
            $('.show-after-login').show();
            $('.hide-after-login').hide();
        } else {
            $('.show-after-login').hide();
            $('.hide-after-login').show();
        }
        
        if (viewName === 'viewHome') {
            loadVotingResults();
        }
    }

    // Attach AJAX "loading" event listener
    $(document).on({
        ajaxStart: function() { $("#ajaxLoadingBox").fadeIn(200) },
        ajaxStop: function() { $("#ajaxLoadingBox").fadeOut(200) }
    });

    function showInfo(message) {
        $('#infoBox>p').html(message);
        $('#infoBox').show();

        $('#infoBox>header').click(function () {
            $('#infoBox').hide();
        });
    }

    function showError(errorMsg, err) {
        let msgDetails = "";
        
        if (err && err.responseJSON){
            msgDetails = err.responseJSON.errorMsg;
        }
        
        $('#errorBox>p').html('Error: ' + errorMsg + msgDetails);
        $('#errorBox').show();
        
        $('#errorBox>header').click(function () {
            $('#errorBox').hide();
        });
    }

    function showProgressBox(percent) {
        let msg = "Wallet encryption / decryption ... " +
            Math.round(percent * 100) + "% complete";
        $('#progressBox').html(msg).show(100);
    }

    function hideProgressProgress() {
        $('#progressBox').hide(100);
    }
    
    function deriveWalletPassword(username, password) {
        return CryptoJS.HmacSHA256(password, 
            username + 'wallet').toString();
    }

    async function register() {
        
        let username = $('#usernameRegister').val();
        let password = $('#passwordRegister').val();
        
        try {
            extraEntropy = '0x' + CryptoJS.HmacSHA256(
                password, username + new Date()).toString();
            let wallet = ethers.Wallet.createRandom({extraEntropy});
            
            walletPassword = deriveWalletPassword(username, password);
            
            let jsonWallet = await wallet.encrypt(
                walletPassword, {}, showProgressBox);
            
            let walletId = CryptoJS.HmacSHA256(
                username, password + 'server').toString();
            
            let result = await $.ajax({
                type: 'POST',
                url: `/register`,
                data: JSON.stringify({walletId, jsonWallet}),
                contentType: 'application/json'
            });
            
            sessionStorage['username'] = username;
            sessionStorage['jsonWallet'] = jsonWallet;
            
            showView("viewHome");
            showInfo(`User "${username}" registered successfully. Please save your mnemonics: <b>${wallet.mnemonic}</b>`);
        }
        catch (err) {
            showError("Cannot register user. ", err);
        }
        finally {
            hideProgressProgress();
        }
    }

    async function login() {
        let username = $('#usernameLogin').val();
        let password = $('#passwordLogin').val();
        let walletId = CryptoJS.HmacSHA256(
            username, password + 'server').toString();
        
        try {
            
            let result = await $.ajax({
                type: 'POST',
                url: `/login`,
                data: JSON.stringify({walletId}),
                contentType: 'application/json'
            });

            sessionStorage['username'] = username;
            sessionStorage['jsonWallet'] = result.jsonWallet;
            
            showView("viewHome");
            showInfo(`User "${username}" logged in successfully.`);
        }
        catch (err) {
            showError("Cannot login user. ", err);
        }
    }

    async function loadVotingResults() {
        try {
            // Load the candidates from the Ethereum smart contract
            let candidates = [];
            candidatesCount = await votingContract.candidatesCount();
            
            /* Loop all candidates and get candidate by id
               In solidity it is not good practice to use loops for that reason we can 
               loop client side. 
            */
            for (let index = 0; index < candidatesCount; index++) {
                let candidate = await votingContract.getCandidate(index);
                let votes = await votingContract.getVotes(index);
                candidates.push({candidate, votes});
            }

            // Display the candidates
            let votingResultsUl = $('#votingResults').empty();
            for (let index = 0; index < candidatesCount; index++) {
                let candidate = candidates[index];
                let li = $('<li>').html(`${candidate.candidate} -> ${candidate.votes} votes `);
                
                if (sessionStorage['username']) {
                    let button = $(`<input type="button" value="Vote">`);
                    button.click(function () { vote(index, candidate.candidate) });
                    li.append(button);
                }

                li.appendTo(votingResultsUl);
            }
        }
        catch (err) {
            showError(err);
        }
    }

    async function vote(candidateIndex, candidateName) {
        try {
            let jsonWallet = sessionStorage['jsonWallet'];
            let password = prompt("Enter your wallet password:");

            walletPassword = deriveWalletPassword(
                sessionStorage['username'], password);
            
            //Gte your wallet and decrypt it
            let wallet = await ethers.Wallet.fromEncryptedWallet(
                jsonWallet, walletPassword, showProgressBox);
            let privateKey = wallet.privateKey;

            //Make an instance of already existing contract
            const votingContract = new ethers.Contract(
                votingContractAddress, votingContractABI,
                new ethers.Wallet(privateKey, ethereumProvider));
            
            // Make transaction to the contract
            let votingResult = await votingContract.vote(candidateIndex);
            let txHash = votingResult.hash;
            showInfo(`Voted successfully for: ${candidateName}. See the transaction: <a href="https://ropsten.etherscan.io/tx/${txHash}" target="_blank">${txHash}</a>`);
        }
        catch (err) {
            showError(err);
        }
        finally {
            hideProgressProgress();
        }
    }

    function logout() {
        // Clear user data
        sessionStorage.clear();
        showView("viewHome");
    }
});