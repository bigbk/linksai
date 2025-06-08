// VIN Research Hub - master.js
// This script handles VIN decoding, dynamic content display, and other interactive functionalities.
// This script relies on the external NHTSA API (vpic.nhtsa.dot.gov) for VIN decoding. Its availability and performance can affect functionality.

$(document).ready(function () {
    // --- Global Variables & Configuration ---
    // Note: Functionality of piserv and awsserv needs external verification as their operational status and HTTPS support cannot be guaranteed.
    var piserv = "https://73.39.163.6/"; 
    var awsserv = "http://3.135.192.197";

    let currentNHTSAMake = '';
    var lastVinFetched = ''; // Added to prevent duplicate NHTSA calls
particlesJS.load('particles-js', 'particles.json', function() {
  console.log('particles.json loaded - callback');
});
    
    // --- VIN Decoding Logic ---
    const wmiToMake = {
        // Volkswagen Group
        '1VW': 'VOLKSWAGEN', '3VW': 'VOLKSWAGEN', // VW USA/Mexico
        'WAU': 'AUDI', 'WUA': 'AUDI', 'WA1': 'AUDI', 'TRU': 'AUDI', // Audi Germany/Hungary
        '2VW': 'VOLKSWAGEN', // VW Canada
        '9BW': 'VOLKSWAGEN', // VW Brazil
        'WVW': 'VOLKSWAGEN', // VW Germany Passenger Cars
        'WVG': 'VOLKSWAGEN', // VW Germany SUVs/Touran
        'WV1': 'VOLKSWAGEN', // VW Commercial Germany
        'WV2': 'VOLKSWAGEN', // VW Commercial Germany
        'AAV': 'VOLKSWAGEN', // VW South Africa
        'SAL': 'LAND ROVER', 
        'SCB': 'BENTLEY',    
        'WP0': 'PORSCHE', 'WP1': 'PORSCHE', 
        'VSS': 'SEAT',       
        'TMB': 'SKODA',      
        'ZHW': 'LAMBORGHINI',

        // BMW Group
        'WBA': 'BMW', 'WBS': 'BMW', 
        'WBX': 'BMW', 'WBY': 'BMW', 
        'WMW': 'MINI',       
        '4US': 'BMW',        
        '5UX': 'BMW',        
        '3AV': 'BMW',        
        'X4X': 'BMW',        

        // Stellantis 
        '1C3': 'CHRYSLER', '1C4': 'CHRYSLER', '2C3': 'CHRYSLER', '3C4': 'CHRYSLER',
        '1B3': 'DODGE', '2B3': 'DODGE', '3B3': 'DODGE', 
        '1D3': 'DODGE', 
        '1J4': 'JEEP', '1J8': 'JEEP', '3J4': 'JEEP',
        '1C6': 'RAM', '2C6': 'RAM', '3C6': 'RAM', 
        'ZFA': 'FIAT',       
        '1F9': 'FIAT',       
        '3F9': 'FIAT',       
        'ZAR': 'ALFA ROMEO', 
        'VF1': 'RENAULT',    
        'VF3': 'PEUGEOT',    
        'VF7': 'CITROEN',    
        'ZCG': 'LANCIA',     

        // Ford Motor Company
        '1FA': 'FORD', '1FB': 'FORD', '1FC': 'FORD', '1FD': 'FORD', '1FM': 'FORD', '1FT': 'FORD', '1ZV': 'FORD', 
        '2FA': 'FORD', '3FA': 'FORD', 
        'WF0': 'FORD',       
        'SFA': 'FORD',       
        'NM0': 'FORD',       
        'MAJ': 'FORD',       
        '1L': 'LINCOLN', '1LN': 'LINCOLN', 
        '1ME': 'MERCURY',    

        // General Motors (GM)
        '1G1': 'CHEVROLET', '1GC': 'CHEVROLET', '1GN': 'CHEVROLET',
        '2G1': 'CHEVROLET', '2GC': 'CHEVROLET', '2GN': 'CHEVROLET', 
        '3G1': 'CHEVROLET', '3GC': 'CHEVROLET', '3GN': 'CHEVROLET', 
        'KL1': 'CHEVROLET',  
        '1GT': 'GMC', '2GT': 'GMC', '3GT': 'GMC',
        '1GY': 'CADILLAC', '2GY': 'CADILLAC', '3GY': 'CADILLAC',
        '1G4': 'BUICK', '2G4': 'BUICK', '3G4': 'BUICK', 
        'LSG': 'BUICK',      
        '1G2': 'PONTIAC', '2G2': 'PONTIAC', '3G2': 'PONTIAC',
        '1G3': 'OLDSMOBILE',
        '1G8': 'SATURN',
        '6G1': 'HOLDEN', '6H8': 'HOLDEN',
        'YS3': 'SAAB',

        // Honda / Acura
        '1HG': 'HONDA', '1HF': 'HONDA', 
        'JH2': 'HONDA',      
        'JH4': 'ACURA',      
        '2HG': 'HONDA',      
        '3HG': 'HONDA',      
        'SHH': 'HONDA',      
        '19U': 'ACURA',      

        // Hyundai / Kia / Genesis
        'KMH': 'HYUNDAI', 'KMC': 'HYUNDAI', 
        '5NM': 'HYUNDAI', '5NP': 'HYUNDAI', 
        'MAL': 'HYUNDAI',    
        'KNA': 'KIA', 'KND': 'KIA',       
        'U5Y': 'KIA',        
        'KMG': 'GENESIS',    
        'KM8': 'GENESIS',    
        
        // Nissan / Infiniti
        'JN1': 'NISSAN', 'JN6': 'NISSAN', 'JN8': 'INFINITI', 
        '5N1': 'NISSAN', '5N3': 'INFINITI', 
        'VSK': 'NISSAN',     
        'SJN': 'NISSAN',     

        // Jaguar Land Rover (JLR - Tata Motors)
        'SAJ': 'JAGUAR',     
        'SCA': 'LAND ROVER', 

        // Toyota / Lexus / Scion
        'JT': 'TOYOTA', 'JTE': 'TOYOTA', 'JTL': 'TOYOTA', 'JTD': 'TOYOTA', 'JTM': 'TOYOTA', 'JTN': 'TOYOTA',
        'JTH': 'LEXUS',      
        'JTK': 'SCION',      
        '4T1': 'TOYOTA', '4T3': 'TOYOTA', 
        '5TB': 'TOYOTA', '5TD': 'TOYOTA', '5TF': 'TOYOTA', 
        '2T1': 'TOYOTA', '2T3': 'TOYOTA',    
        'SB1': 'TOYOTA',     

        // Mazda
        'JM1': 'MAZDA', 'JMZ': 'MAZDA', 
        '4F': 'MAZDA',       
        '3MD': 'MAZDA',      

        // Mercedes-Benz Group
        'WDD': 'MERCEDES-BENZ', 'WDB': 'MERCEDES-BENZ', 'WDC': 'MERCEDES-BENZ', 
        '4JG': 'MERCEDES-BENZ', '55S': 'MERCEDES-BENZ', 
        'NMB': 'MERCEDES-BENZ', 

        // Mitsubishi
        'JA3': 'MITSUBISHI', 'JA4': 'MITSUBISHI', 
        '4A3': 'MITSUBISHI', '4A4': 'MITSUBISHI', 

        // Subaru
        'JF1': 'SUBARU', 'JF2': 'SUBARU', 
        '4S3': 'SUBARU', '4S4': 'SUBARU', 

        // Tesla
        '5YJ': 'TESLA',      
        '7SA': 'TESLA',      
        'LRW': 'TESLA',      
        'XP7': 'TESLA',      

        // Volvo (Geely)
        'YV1': 'VOLVO', 'YV4': 'VOLVO', 
        'YV2': 'VOLVO', 'YV3': 'VOLVO', 
        'LPS': 'POLESTAR',   
        'YSM': 'POLESTAR',   

        // Newer EV Manufacturers (Examples)
        '7FC': 'RIVIAN',     
        '5L1': 'LUCID',      
        'NVV': 'VINFAST',    
        
        // Other Manufacturers (Examples)
        'SDB': 'PEUGEOT',    
        'SUU': 'ISUZU',      
        'TMT': 'TATRA',      
        'XL9': 'SPYKER',     
        'SCC': 'LOTUS',      
        'ZAM': 'MASERATI'    
    };

    const makeToDivId = {
        'AUDI': 'audi_div', 'VOLKSWAGEN': 'audi_div', 'BENTLEY': 'audi_div', 'PORSCHE': 'porsche_div', 
        'SEAT': 'audi_div', 'SKODA': 'audi_div', 'LAMBORGHINI': 'audi_div',
        'BMW': 'bmw_div', 'MINI': 'bmw_div',
        'CHRYSLER': 'chrysler_div', 'JEEP': 'chrysler_div', 'DODGE': 'chrysler_div', 'RAM': 'chrysler_div',
        'FIAT': 'chrysler_div', 'ALFA ROMEO': 'chrysler_div', 'PEUGEOT': 'chrysler_div', 
        'CITROEN': 'chrysler_div', 'LANCIA': 'chrysler_div', 
        'FORD': 'ford_div', 'LINCOLN': 'ford_div', 'MERCURY': 'ford_div',
        'GM': 'gm_div', 'CHEVROLET': 'gm_div', 'GMC': 'gm_div', 'CADILLAC': 'gm_div',
        'BUICK': 'gm_div', 'PONTIAC': 'gm_div', 'OLDSMOBILE': 'gm_div', 'SATURN': 'gm_div',
        'HOLDEN': 'gm_div', 'SAAB': 'gm_div', 
        'HONDA': 'honda_div', 'ACURA': 'honda_div',
        'HYUNDAI': 'hyundai_div', 'GENESIS': 'hyundai_div', 'KIA': 'kia_div',
        'INFINITI': 'nissaninfiniti_div', 'NISSAN': 'nissaninfiniti_div',
        'JAGUAR': 'lr_div', 'LAND ROVER': 'lr_div',
        'LEXUS': 'lexus_div', 'SCION': 'lexus_div', 'TOYOTA': 'toyota_div',
        'MASERATI': 'maserati_div', 'MAZDA': 'mazda_div', 'MERCEDES-BENZ': 'mercedes_div',
        'MITSUBISHI': 'mitsubishi_div', 'SUBARU': 'subaru_div', 'TESLA': 'tesla_div',
        'VOLVO': 'volvo_div', 'POLESTAR': 'volvo_div', 
        'RIVIAN': 'tesla_div', 'LUCID': 'tesla_div', 'VINFAST': 'hyundai_div', 
        'RENAULT': 'nissaninfiniti_div', 'ISUZU': 'gm_div', 
        'TATRA': 'common_div', 'SPYKER': 'common_div', 'LOTUS': 'common_div',
        'COMMON': 'common_div' 
    };

    const allMakeDivIds = [...new Set(Object.values(makeToDivId))]; 

    // --- Helper function to get VIN or show alert ---
    function getVinOrAlert() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        if (vinValue.length === 17) {
            return vinValue;
        } else {
            $('#output').html("<strong>VIN Required:</strong> Please enter a valid 17-digit VIN before using this link.");
            $('#outputbox').stop().fadeIn(); 
            return null;
        }
    }
    
    // --- START: Original Helper Functions from User Snippet (Adapted) ---
    function checkAuthentication(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                callback(xhr.status);
            }
        };
        xhr.send();
    }

    function isAuthorized(callback) {
        // FIXME: This is a placeholder authorization function and always returns true. Implement actual user authorization logic if required.
        // Placeholder authorization - replace with actual logic if needed
        console.warn("Using placeholder authorization. Implement actual check in isAuthorized().");
        callback(true); 
    }

    function vincheckin(callback) {
        const currentVin = getVinOrAlert(); 
        if (currentVin) { 
            isAuthorized(function(authorized) {
                if (authorized) {
                    console.log('User is authorized (placeholder).');
                    callback(true, currentVin); 
                } else {
                    console.log('User is not authorized.');
                    alert("Authorization check failed (placeholder). Please Login.");
                    callback(false, null); 
                }
            });
        } else {
            callback(false, null); 
        }
    }

    function openWindowWithVin(urlPattern) { 
        vincheckin(function(isValidAndAuthorized, checkedVin) {
            if (isValidAndAuthorized && checkedVin) {
                // Replace placeholder in URL pattern with actual VIN
                window.open(urlPattern.replace('VIN_PLACEHOLDER', checkedVin).replace(/\$\{vin\}/g, checkedVin), '_blank');
            }
        });
    }
    
    function openWindowWithVin2(targetUrlPattern) {
        vincheckin(function(isValidAndAuthorized, checkedVin) {
            if (isValidAndAuthorized && checkedVin) {
                const targetUrl = targetUrlPattern.replace('VIN_PLACEHOLDER', checkedVin);
                const encodedURL = encodeURIComponent(targetUrl);
                const obfuscatedURL = btoa(encodedURL); 
                const finalurl = awsserv + "/ps?url=" + obfuscatedURL;
                window.open(finalurl, '_blank');
            }
        });
    }
    // --- END: Original Helper Functions ---


    // --- Core Display Functions ---
    window.hideAllMakeSpecificDivs = function() {
        allMakeDivIds.forEach(id => {
            if (id !== 'general_links_div') { 
                 $('#' + id).addClass('d-none');
            }
        });
        $('#identifiedMake').text('');
    };

    window.showMakeSpecificDiv = function(make) {
        allMakeDivIds.forEach(id => {
            $('#' + id).addClass('d-none');
        });
        
        const divId = makeToDivId[make.toUpperCase()]; 
        const commonDivId = makeToDivId['COMMON'];

        $('#general_links_div').removeClass('d-none'); 

        if (divId) {
            $('#' + divId).removeClass('d-none'); 
            $('#identifiedMake').text(`Identified Make: ${make} (Displaying specific & common links)`);
            
            if (commonDivId && divId !== commonDivId) { 
                $('#' + commonDivId).removeClass('d-none');
            }
        } else {
            $('#identifiedMake').text(`Make "${make}" not recognized. Showing general & common links.`);
            if (commonDivId) { 
                 $('#' + commonDivId).removeClass('d-none');
            }
        }
    };

    window.updateDisplay = function(makeKey) {
        const commonDivId = makeToDivId['COMMON'];

        if (makeKey === 'ALL' || !makeKey) {
            allMakeDivIds.forEach(id => {
                if (id !== commonDivId) { 
                    $('#' + id).addClass('d-none');
                }
            });
            $('#general_links_div').removeClass('d-none'); 
            if (commonDivId) { 
                 $('#' + commonDivId).removeClass('d-none');
            }
            $('#identifiedMake').text('Showing General & Common Research Links');
        } else {
            showMakeSpecificDiv(makeKey); 
        }
    };

    window.handleVinInput = function() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        const commonDivId = makeToDivId['COMMON'];
        $('#general_links_div').removeClass('d-none'); 

        if (vinValue.length === 0) {
            updateDisplay('ALL'); 
            $('#txt_results').val(''); // Clear NHTSA results if VIN is cleared
            $('#output').text(''); 
            $('#outputbox').hide();
            currentNHTSAMake = '';
            return;
        }

        if (vinValue.length >= 3) { 
            const make = getMakeFromVin(vinValue);
            if (make) {
                showMakeSpecificDiv(make); 
            } else {
                $('#identifiedMake').text(`Typing VIN: ${vinValue.substring(0,3)}... (Make not yet identified)`);
                allMakeDivIds.forEach(id => {
                     if (id !== commonDivId) {
                        $('#' + id).addClass('d-none');
                     }
                });
                if (commonDivId) { $('#' + commonDivId).removeClass('d-none'); } 
            }
        } else {
            $('#identifiedMake').text('Enter at least 3 characters of VIN...');
            allMakeDivIds.forEach(id => { 
                 if (id !== commonDivId) {
                    $('#' + id).addClass('d-none');
                 }
            });
            if (commonDivId) { $('#' + commonDivId).removeClass('d-none'); } 
        }

        // **Automatically fetch NHTSA data when 17 digits are entered**
        if (vinValue.length === 17) {
            if (typeof getNHTSADataByVIN === "function") {
                getNHTSADataByVIN(vinValue);
            } else {
                console.warn("getNHTSADataByVIN function is not defined. NHTSA data will not be fetched automatically on VIN input.");
            }
        }
    };

    window.processVinAndDisplay = function() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        $('#VINbar').val(vinValue); 

        $('#general_links_div').removeClass('d-none'); 

        if (vinValue.length !== 17) {
            $('#output').html("<strong>Validation Error:</strong> Please enter a full 17-digit VIN.");
            $('#outputbox').fadeIn();
            updateDisplay('ALL'); 
            return;
        }

        const make = getMakeFromVin(vinValue);
        if (make) {
            showMakeSpecificDiv(make); 
            $('#output').html(`Displaying links for identified make: <strong>${make}</strong>.`);
            $('#outputbox').fadeIn().delay(2500).fadeOut(); 
        } else {
            $('#output').html(`<strong>Notice:</strong> Make not identified for this VIN. Showing general & common research links.`);
            $('#outputbox').fadeIn().delay(3500).fadeOut();
            updateDisplay('ALL'); 
        }

        // NHTSA data fetch is already triggered by handleVinInput if 17 digits are typed.
        // Calling it here again would be redundant if user types 17 digits then clicks.
        // However, if user pastes 17 digits and clicks, handleVinInput might not have fired for the 17th char.
        // So, it's safer to keep it here as well, or add a flag to prevent double calls.
        // For now, keeping it for robustness.
        if (typeof getNHTSADataByVIN === "function") {
            getNHTSADataByVIN(vinValue);
        } else {
            console.warn("getNHTSADataByVIN function is not defined. NHTSA data will not be fetched on submit.");
        }
    };

    function getMakeFromVin(vin) {
        if (typeof vin !== 'string' || vin.length < 3) {
            return null;
        }
        const wmi = vin.substring(0, 3).toUpperCase();
        return wmiToMake[wmi] || null;
    }

    // --- Event Listeners ---
    $('#btn_submit').on('click', processVinAndDisplay);
    $('#VINbar').on('keypress', function(e) {
        if (e.which == 13) { 
            processVinAndDisplay();
            e.preventDefault(); 
        }
    });

    if (document.getElementById("kmxbutton")) {
        document.getElementById("kmxbutton").onclick = function () {
            var favorite = [];
            $.each($("input[name='options']:checked"), function () {
                favorite.push($(this).val());
            });
            var tcyl = document.getElementById("icyl").value ? "cylinders-" + document.getElementById("icyl").value : "";
            var carmaxUrl = "https://www.carmax.com/cars" +
                (document.getElementById("iyear").value ? "/" + document.getElementById("iyear").value : "") +
                (document.getElementById("imake").value ? "/" + document.getElementById("imake").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") + 
                (document.getElementById("imodel").value ? "/" + document.getElementById("imodel").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") +
                (document.getElementById("itrim").value ? "/" + document.getElementById("itrim").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") +
                (tcyl ? "/" + tcyl : "") +
                (favorite.length > 0 ? "/" + favorite.join("/") : "") +
                "?zip=21162&sort=4&distance=all"; 
            window.open(carmaxUrl, '_blank');
        };
    }
    
    // --- JSON Fetch Helper (from v7) ---
    function attemptJsonFetch(url, makeName) {
        $('#output').html(`Attempting to fetch ${makeName} data... <small>(May be blocked by browser or API changes)</small>`);
        $('#outputbox').stop().fadeIn();
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    let errorDetail = `Network response was not ok: ${response.status} ${response.statusText}`;
                    if (response.type === 'opaque') { 
                        errorDetail = "Received an opaque response, likely due to CORS. Cannot read data.";
                    }
                    throw new Error(errorDetail);
                }
                return response.json();
            })
            .then(data => {
                console.log(`${makeName} Data Received:`, data);
                $('#output').html(`<strong>${makeName} Data Received (JSON):</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`);
                $('#outputbox').stop().fadeIn(); 
            })
            .catch(error => {
                console.error(`Error fetching ${makeName} data:`, error);
                $('#output').html(
                    `<strong>Could not fetch ${makeName} data directly.</strong><br>` +
                    `<small>This can happen due to browser security (CORS), API changes, or network issues.</small><br>` +
                    `You can try to access the data directly by clicking here: ` +
                    `<a href="${url}" target="_blank" class="text-warning fw-bold">Open ${makeName} Data Link</a><br>` +
                    `<small>Error details: ${error.message}</small>`
                );
                $('#outputbox').stop().fadeIn();
            });
    }

    // --- Individual Make/Link Functions (Restored original patterns) ---
    window.getnissansticker2 = function() { openWindowWithVin(`${piserv}/nissan?vin=VIN_PLACEHOLDER`); }; 
    window.getnissansticker3 = function() { openWindowWithVin2(`https://www.carsonnissan.com/api/legacy/pse/windowsticker/nissan?vin=VIN_PLACEHOLDER`); };
    window.getnissansticker4 = function() { openWindowWithVin2(`https://nissan-services.web-aws.dealersocket.com/production/sticker/VIN_PLACEHOLDER`); };
    window.toyotasticker = function() { openWindowWithVin2(`https://www.royalsouthtoyota.com/api/OEMProgramsCommon/ToyotaDDOAWindowSticker?vin=VIN_PLACEHOLDER`); };
    window.toyotasticker3 = function() { openWindowWithVin2(`https://api-windowsticker.web-aws.dealersocket.com/toyota/VIN_PLACEHOLDER`); };
    window.velocitysticker = function() { openWindowWithVin2(`https://app.velocityautomotive.com/windowsticker/vin/VIN_PLACEHOLDER/account/applefordwhitebearlake`); };
    window.tytspecs = function() { openWindowWithVin(`${awsserv}/toyota?vin=VIN_PLACEHOLDER`); };
    window.lxsspecs = function() { openWindowWithVin(`${awsserv}/lexus?vin=VIN_PLACEHOLDER`); };
    window.invoice = function() { openWindowWithVin(`${awsserv}/invoice?vin=VIN_PLACEHOLDER`); };
    window.wclutch = function() { openWindowWithVin2(`https://www.withclutch.com/window-stickers`); }; 
    window.hclutch = function() { openWindowWithVin(`${awsserv}/hclutch?vin=VIN_PLACEHOLDER`); };
    window.autobrochures = function() {
    const makeForBrochure = currentNHTSAMake.toLowerCase();
    if (makeForBrochure !== "" && makeForBrochure !== 'undefined') {
        openWindowWithVin("http://www.auto-brochures.com/" + makeForBrochure + ".html");
    } else {
        // Fallback to the main auto-brochures page if make is not identified
        openWindowWithVin("http://www.auto-brochures.com/");
    }
    };
    window.bimmerbtn = function() { 
        const currentVin = getVinOrAlert();
        if(currentVin) openWindowWithVin("https://www.mdecoder.com/decode/" + currentVin.slice(-7));
    }; 
    window.bmwlane = function() { openWindowWithVin2("http://windowsticker-prod.awsmdotcom.manheim.com/windowsticker/BMW/VIN_PLACEHOLDER"); }; 
    window.miniog = function() {
        var myear = $("#myear").val(); var mmodel = $("#mmodel").val();
        if(myear && mmodel) { window.open('https://www.google.com/search?q=' + encodeURIComponent(myear + ' ' + mmodel + ' mini cooper ordering guide site:minimedia.iconicweb.com'), '_blank'); } 
        else { alert("Please enter Year and Model for MINI Guide Search."); }
    };
    window.chrysler = function () { openWindowWithVin2("https://www.chrysler.com/hostd/windowsticker/getWindowStickerPdf.do?_ga=2.123817667.856222938.1715011172-964708610.1715011172&vin=VIN_PLACEHOLDER"); }; 
    window.chryslerlist = function () { openWindowWithVin2("http://www.jeep.com/webselfservice/BuildSheetServlet?vin=VIN_PLACEHOLDER"); }; 
    window.chryslerlist2 = function () { openWindowWithVin2("http://www.chrysler.com/webselfservice/BuildSheetServlet?vin=VIN_PLACEHOLDER"); }; 
    window.chryslerlist3 = function () { openWindowWithVin2("http://www.dodge.com/webselfservice/BuildSheetServlet?vin=VIN_PLACEHOLDER"); }; 
    window.decoderz = function() { openWindowWithVin("https://www.vindecoderz.com/EN/check-lookup/VIN_PLACEHOLDER"); }; 
    window.siriusxm = function() { openWindowWithVin2("https://care.siriusxm.com/vinlookup_findVin.action?vin=VIN_PLACEHOLDER"); };
    window.bidhistory = function() { openWindowWithVin("https://en.bidhistory.org/search/?search=VIN_PLACEHOLDER"); };
    window.ford = function () { openWindowWithVin("https://www.etis.ford.com/selectedVehicleDetails.do#vin=VIN_PLACEHOLDER"); };
    window.fordsticker = function () { openWindowWithVin2("http://www.windowsticker.forddirect.com/windowsticker.pdf?vin=VIN_PLACEHOLDER"); };
    window.fordstickerkey = function () { openWindowWithVin2("https://imola.adesa.com/auction-engine-web-api/encryptVin.json?cgId=947&sellerOrgId=201721&isRunList=1&vin=VIN_PLACEHOLDER"); }; 
    window.fordstickerkey2 = function () {
        const currentVin = getVinOrAlert(); 
        const mkey = $('#mkey').val().trim();
        if (currentVin && mkey !== "") { 
            openWindowWithVin2("https://windowsticker.concentrix.com/windowsticker/auction_ws/index.htm?sProgramCode=FORD_VR&loginId=1&quic_param=" + mkey);
        } else if (currentVin && mkey === "") {
            alert("Please enter the Concentrix key.");
        }
    };
    window.fordwiki = function () { openWindowWithVin(awsserv + "/ford?vin=VIN_PLACEHOLDER"); };
    window.gmlink = function () { openWindowWithVin2("https://windowsticker-prod.aws.manheim.com/showGmWs?auctionID=&workOrderNumber=7055030&sblu=11546249&vin=VIN_PLACEHOLDER"); };
    window.gmlink2 = function () {
    const vin = getVinOrAlert(); // Retrieve VIN using existing helper
        if (!vin) {
            return; // Exit if no valid VIN
        }

    const modifiedVin = vin;
    function encodeUTF16LE(str) {
        const buf = new ArrayBuffer(str.length * 2);
        const view = new DataView(buf);
        for (let i = 0; i < str.length; i++) {
            view.setUint16(i * 2, str.charCodeAt(i), true); // little-endian
        }
        return new Uint8Array(buf);
    }

    const utf16leBytes = encodeUTF16LE(modifiedVin);
    const base64Vin = btoa(String.fromCharCode(...utf16leBytes));
    const urlEncodedVin = encodeURIComponent(base64Vin);
    const url = "https://www.walkerjoneschevy.com/api/vhcliaa/inventory/28622/window-sticker?sv=" + urlEncodedVin + "&make=Chevrolet&dealerCode=114772";
    openWindowWithVin(url);
};
    
    window.honda2 = function () { openWindowWithVin(awsserv + "/honda?vin=VIN_PLACEHOLDER"); }; 
    window.acura = function () { openWindowWithVin(awsserv + "/acura?vin=VIN_PLACEHOLDER"); }; 
    
    window.hyunwiki = function () { openWindowWithVin(awsserv + "/hyundai/?model=Venue&vin=VIN_PLACEHOLDER"); }; 
    
    window.infiniti = function() { 
        vincheckin(function(isValidAndAuthorized, checkedVin) {
            if (isValidAndAuthorized && checkedVin) {
                window.open("https://www.oemstickers.com/WindowSticker.php?vin=" + checkedVin, '_blank');
                // Removed setTimeout and second window.open call
            }
        });
    };
    window.infinititrm = function() { openWindowWithVin("https://www.infinitiusa.com/recalls-vin/#/#/Results/VIN_PLACEHOLDER"); }; 
    
    window.kiabtn2 = function() { 
        openWindowWithVin2("https://www.happykia.com/Api/api/pdf/kia-oem-windows-sticker?vin=VIN_PLACEHOLDER&accountid=54926");
    };
    window.kiabtn3 = function() { 
        vincheckin(function(isValidAndAuthorized, checkedVin) {
            if (isValidAndAuthorized && checkedVin) {
                var winkia = window.open("https://www.kia.com", '_blank');
                setTimeout(function () {
                    if(winkia) winkia.close(); 
                    window.open("https://www.kia.com/us/en/data/dealerinventory/windowsticker/" + checkedVin, '_blank');
                }, 3000);
            }
        });
    };
    
    window.manheimmmr = function() { openWindowWithVin("https://mmr.manheim.com/?WT.svl=m_hdr_mnav_buy_mmr&country=US&popup=true&source=man&vin=VIN_PLACEHOLDER"); };
    window.manheimsearch = function() { openWindowWithVin("https://www.manheim.com/members/powersearch/keywordSearchResults.do?searchTerms=VIN_PLACEHOLDER"); };
    window.maserati = function() { openWindowWithVin2("https://www.herbchambers.com/api/legacy/pse/windowsticker/maserati?country=US&language=en&vin=VIN_PLACEHOLDER"); };
    
    // Mazda: Retain v7 logic
    window.mazdabtn2 = function() { alert("Mazda alternate window sticker link is currently unavailable."); };
    window.mazdabtn = function() { const vin = getVinOrAlert(); if(vin) { alert("Mazda dealer inventory sticker link needs specific dealer portal. Searching Google."); window.open('https://www.google.com/search?q=mazda+dealer+inventory+window+sticker+' + vin, '_blank'); } };
    
    window.mitsbtn = function() { openWindowWithVin2("https://www.yorkmitsubishi.com/api/OEMProgramsCommon/MitsubishiWindowStickerUrl?vin=VIN_PLACEHOLDER"); };
    
    window.nissan = function() { 
        vincheckin(function(isValidAndAuthorized, checkedVin) {
            if (isValidAndAuthorized && checkedVin) {
                window.open("https://www.oemstickers.com/WindowSticker.php?vin=" + checkedVin, '_blank');
                // Removed setTimeout and second window.open call
            }
        });
    };
    window.nissantrm = function() { openWindowWithVin("https://www.nissanusa.com/recalls-vin/#/#/Results/VIN_PLACEHOLDER"); }; 
    window.porwiki = function() { openWindowWithVin("https://vinanalytics.com/car/VIN_PLACEHOLDER/VIN_PLACEHOLDER.pdf"); };
    window.subarusticker = function() { openWindowWithVin2(`https://windowsticker.subaru.com/customerMonroneyLabel/pdf?vin=VIN_PLACEHOLDER&jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3Nzg1MzYwMDEsImlzcyI6InN1YmFydSIsImF1ZCI6InNob3dtYXgiLCJlbnYiOiJwcm9kIiwid3MiOiJ3aW5kb3dTdGlja2VyL3IifQ.i6582N-cIJqcTGswegYQZUFCQLA_OlXUoI6E9ATcIdM`); };
    window.subaru = function() { openWindowWithVin("https://www.subaru.com/owners/vehicle-resources.html?model=VIN_PLACEHOLDER"); }; 
    window.subaru2 = function () { openWindowWithVin(awsserv + "/subaru?vin=VIN_PLACEHOLDER"); }; 
    
    window.tesla = function() { 
        const currentVin = getVinOrAlert();
        if (!currentVin) return;
        const aYear = $('#iyear').val() || prompt('What year is the vehicle?');
        let aModel = $('#imodel').val() || prompt('What model is the vehicle? (Enter only X, 3, S, ...');
        const aMake = 'tesla';
        if (aModel && aYear) {
            aModel = String(aModel).trim().toUpperCase();
            aModel = aModel.startsWith('MODEL') ? aModel : `MODEL ${aModel}`;
            const modelSlug = aModel.replace(/ /g, '_').toLowerCase();
            const makeSlug = aMake.toLowerCase();
            const url = `https://www.cars.com/research/${makeSlug}-${modelSlug}-${aYear}/trims/`;
            window.open(url, '_blank');
        } else {
            alert("Year and Model are required for Tesla trim search.");
        }
    }; 
    window.tesla2 = function() { openWindowWithVin("https://tesla-info.com/inventory.php?country=US&state=&sale=All&min=&max=9999999&milemin=&milemax=&ap=All&model=All&variant=All&title=undefined&minyear=2008&maxyear=2022&colour=All&interior=All&seats=All&wheels=0&titlestat=All&minrange=&search=VIN_PLACEHOLDER"); }; 
    window.teslam = function() { 
        const currentVin = getVinOrAlert(); 
        if (!currentVin) return;
        let aModel = $('#imodel').val() || prompt("What model is the vehicle? (Enter only X, 3, S, ...");
        if (aModel) {
            aModel = String(aModel).trim().toUpperCase();
            aModel = aModel.startsWith('MODEL') ? aModel : `MODEL ${aModel}`;
            var mdlad = aModel.replace(/ /g, "_").toLowerCase();
            var manualUrl = "https://www.tesla.com/sites/default/files/" + mdlad + "_owners_manual_north_america_en.pdf";
            if (mdlad === "model_s") {
                manualUrl = "https://www.tesla.com/sites/default/files/" + mdlad + "_owners_manual_north_america_en_us.pdf";
            }
            window.open(manualUrl, '_blank');
        } else {
            alert("Tesla model is required for owner's manual.");
        }
    }; 
    
 
    window.volvosticker = function() { openWindowWithVin("https://volvocars.niello.com/api/legacy/pse/windowsticker/volvo?vin="); };
    
    window.vwaudilane = function () { openWindowWithVin2("http://windowsticker-prod.awsmdotcom.manheim.com/windowsticker/VIN_PLACEHOLDER/4905414"); };
window.hitcher = function() {
    const currentVin = getVinOrAlert();
    if (!currentVin) return;

    const aYear = $('#iyear').val().trim();
    const aMake = $('#imake').val().trim().toLowerCase().replace(/\s+/g, '-');
    const aModel = $('#imodel').val().trim().toLowerCase().replace(/\s+/g, '-');

    if (aYear && aMake && aModel) {
        console.log("Opening eTrailer hitch search for:", aYear, aMake, aModel);
        const hitchUrl = `https://www.etrailer.com/hitch-${aYear}_${aMake}_${aModel}.htm`;
        window.open(hitchUrl, '_blank');
    } else {
        alert("Year, Make, and Model are required for hitch lookup.\n\nHint: Click 'Submit VIN' to auto-populate if unsure.");
    }
};


    // --- NHTSA Data Fetching Function (Restored original $.ajax structure) ---
    window.getNHTSADataByVIN = function(vinToQuery) {
        if (vinToQuery === lastVinFetched) {
            console.log("NHTSA data for " + vinToQuery + " already fetched or being fetched.");
            return; // Avoid refetching for the same VIN immediately
        }
        lastVinFetched = vinToQuery;

        if (!vinToQuery) {
            console.error('No VIN provided to getNHTSADataByVIN');
            $('#txt_results').val('Error: No VIN provided for NHTSA lookup.');
            return;
        }
        $('#txt_results').val(`Fetching NHTSA data for VIN: ${vinToQuery}...`);

        $.ajax({
            url: "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/",
            type: "POST",
            data: { format: "json", data: vinToQuery }, // Batch API expects 'data' parameter
            dataType: "json",
            success: function (result) {
                console.log("NHTSA Result:", result);
                if (result && result.Results && result.Results.length > 0) {
                    var vehicleData = result.Results[0];
                    currentNHTSAMake = vehicleData.Make || ''; // Ensure it's an empty string if null/undefined
            var displayData = {
                aYear: vehicleData.ModelYear || "",
                aMake: vehicleData.Make || "",
                aModel: vehicleData.Model || "",
                aSeries: vehicleData.Series || "",
                aTrim: vehicleData.Trim || "",
                aDisp: vehicleData.DisplacementL ? parseFloat(vehicleData.DisplacementL).toFixed(1) + "L" : "",
                aFuel: vehicleData.FuelTypePrimary || "",
                aCyl: vehicleData.EngineCylinders ? vehicleData.EngineCylinders + "cyl" : "",
                aDrive: vehicleData.DriveType || "",
                aDoor: vehicleData.Doors ? vehicleData.Doors + "D" : "",
                aCab: vehicleData.BodyCabType || "",
                aBody: vehicleData.BodyClass || ""
            };
                    
                    updateInputFields(displayData); // Original helper
                    if (document.getElementById("output")) document.getElementById("output").innerText = formatOutputText(displayData); // Original helper
                    if (document.getElementById("outputbox")) document.getElementById("outputbox").style.display = 'block';
                    
                    displayNHTSAResults(result); // Original helper to populate txt_results and update display by make
                } else {
                    if (document.getElementById("txt_results")) document.getElementById("txt_results").value = `No detailed results from NHTSA for VIN: ${vinToQuery}. Message: ${result.Message || 'Unknown error.'}`;
                    currentNHTSAMake = '';
                }
            },
            error: function (xhr, ajaxOptions, thrownError) {
                console.error('Error fetching NHTSA data: ' + xhr.status);
                console.error(thrownError);
                if (document.getElementById("txt_results")) document.getElementById("txt_results").value = 'Could not retrieve data from NHTSA for VIN: ' + vinToQuery + '. Please check the VIN or try again later.\nDetails: Status ' + xhr.status + ' - ' + (thrownError || xhr.responseText);
                currentNHTSAMake = ''; // Reset make if NHTSA call fails
            }
        });
    };

    // --- Original Helper functions for NHTSA display ---
    function updateInputFields(data) {
        if (document.getElementById("iyear")) document.getElementById("iyear").value = data.aYear;
        if (document.getElementById("imake")) document.getElementById("imake").value = data.aMake;
        if (document.getElementById("imodel")) document.getElementById("imodel").value = data.aModel;
        if (document.getElementById("icyl")) document.getElementById("icyl").value = data.aCyl.replace('cyl',''); // Remove 'cyl' for input
    }

    function formatOutputText(data) {
        return `${data.aYear} ${data.aMake} ${data.aModel} ${data.aSeries} ${data.aTrim}, ${data.aDisp} ${data.aFuel}, ${data.aCyl} \n ${data.aDoor}${data.aCab} ${data.aBody}, ${data.aDrive} \r\n (NHTSA data. Verify trim independently.)`;
    }

    function displayNHTSAResults(param_data) {
        var output_text = "";
        param_data.Results.forEach(function(result) {
            for (var prop in result) {
                if (result.hasOwnProperty(prop) && result[prop] !== "" && result[prop] !== null) { // Check for null too
                    output_text += `${prop}: ${result[prop]}\n`;
                }
            }
        });

        if (document.getElementById("txt_results")) document.getElementById("txt_results").value = output_text;
        if (document.getElementById("nhtsa_data")) document.getElementById("nhtsa_data").style.display = 'block';
        
        // Update display based on Make from NHTSA
        if (param_data.Results[0] && param_data.Results[0].Make) {
            console.log(`Manufacturer found using NHTSA data: ` + param_data.Results[0].Make);
            updateDisplay(param_data.Results[0].Make); // This is the v7 updateDisplay
        }
    }
    // --- End Original Helper functions for NHTSA display ---

    updateDisplay('ALL'); 
});
