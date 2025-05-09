// VIN Research Hub - master.js
// This script handles VIN decoding, dynamic content display, and other interactive functionalities.

$(document).ready(function () {
    // --- Global Variables & Configuration ---
    // Variables for external services (ensure these are correctly used by getNHTSADataByVIN if defined elsewhere)
    var piserv = "https://73.39.163.6/"; // Example, ensure this is secure if used for POST
    var awsserv = "http://3.16.31.159";  // Example
    // Note: The 'vin' global variable from the original inline script is now handled locally within functions or via $('#VINbar').val().

    // --- VIN Decoding Logic ---
    // Simplified WMI to Make mapping. This is a crucial part for auto-detection.
    // Consider expanding this list for better accuracy across more manufacturers and regions.
    const wmiToMake = {
        '1VW': 'VOLKSWAGEN', '3VW': 'VOLKSWAGEN', 'WAU': 'AUDI', 'WUA': 'AUDI', 'TRU': 'AUDI', // Audi/VW Group
        '2VW': 'VOLKSWAGEN', // Canada
        '9BW': 'VOLKSWAGEN', // Brazil
        'WBA': 'BMW', 'WBS': 'BMW', 'WBX': 'BMW', 'WBY': 'BMW', 'WMW': 'MINI', // BMW Group (WBS is often BMW M)
        '4US': 'BMW', '5UX': 'BMW', '5YJ': 'TESLA', // BMW US & Tesla (5YJ was BMW, now primarily Tesla) - Check VIN patterns carefully
        '1C3': 'CHRYSLER', '1C4': 'CHRYSLER', '2C3': 'CHRYSLER', '3C4': 'CHRYSLER', // Chrysler
        '1J4': 'JEEP', '1J8': 'JEEP', // Jeep
        'ZAR': 'ALFA ROMEO', 'ZFA': 'FIAT', // Fiat/Alfa
        '1FA': 'FORD', '1FB': 'FORD', '1FC': 'FORD', '1FD': 'FORD', '1FM': 'FORD', '1FT': 'FORD', '1ZV': 'FORD', // Ford
        '2FA': 'FORD', '3FA': 'FORD', // Ford (Canada, Mexico)
        '1L': 'LINCOLN', '1LN': 'LINCOLN', // Lincoln
        '1ME': 'MERCURY', // Mercury
        '1G1': 'CHEVROLET', '1GC': 'CHEVROLET', '1GN': 'CHEVROLET', '1GT': 'GMC', '1GY': 'CADILLAC', // GM
        '2G1': 'CHEVROLET', '2GC': 'CHEVROLET', '2GN': 'CHEVROLET', '2GT': 'GMC', '2GY': 'CADILLAC', // GM Canada
        '3G1': 'CHEVROLET', '3GC': 'CHEVROLET', '3GN': 'CHEVROLET', '3GT': 'GMC', '3GY': 'CADILLAC', // GM Mexico
        'YS3': 'SAAB', // Saab (formerly GM)
        '1HG': 'HONDA', '1HF': 'HONDA', 'JH2': 'HONDA', 'JH4': 'ACURA', // Honda/Acura
        'KMH': 'HYUNDAI', 'KMC': 'HYUNDAI', 'KNA': 'KIA', 'KND': 'KIA', // Hyundai/Kia Korea
        '5NM': 'HYUNDAI', '5NP': 'HYUNDAI', // Hyundai US
        'U5Y': 'KIA', // Kia US
        'MAL': 'HYUNDAI', // Hyundai (Genesis often under Hyundai WMI, but might have its own too e.g., KMG)
        'KMG': 'GENESIS', // Genesis specific WMI example
        'JN1': 'NISSAN', 'JN6': 'NISSAN', 'JN8': 'INFINITI', // Nissan/Infiniti Japan
        '5N1': 'NISSAN', '5N3': 'INFINITI', // Nissan/Infiniti US
        'SAL': 'LAND ROVER', 'SAJ': 'JAGUAR', // JLR
        'JT': 'TOYOTA', 'JTE': 'TOYOTA', 'JTL': 'TOYOTA', 'JTD': 'TOYOTA', 'JTH': 'LEXUS', 'JTK': 'SCION', // Toyota/Lexus/Scion Japan
        '4T1': 'TOYOTA', '4T3': 'TOYOTA', '5TB': 'TOYOTA', '5TD': 'TOYOTA', '5TF': 'TOYOTA', // Toyota US
        '2T1': 'TOYOTA', // Toyota Canada
        'JM1': 'MAZDA', 'JMZ': 'MAZDA', // Mazda Japan
        '4F': 'MAZDA', // Mazda US
        'WDD': 'MERCEDES-BENZ', 'WDB': 'MERCEDES-BENZ', 'WDC': 'MERCEDES-BENZ', // Mercedes Germany
        '4JG': 'MERCEDES-BENZ', '55S': 'MERCEDES-BENZ', // Mercedes US
        'JA3': 'MITSUBISHI', 'JA4': 'MITSUBISHI', // Mitsubishi Japan
        '4A3': 'MITSUBISHI', '4A4': 'MITSUBISHI', // Mitsubishi US
        'WP0': 'PORSCHE', 'WP1': 'PORSCHE', // Porsche
        'JF1': 'SUBARU', 'JF2': 'SUBARU', // Subaru Japan
        '4S3': 'SUBARU', '4S4': 'SUBARU', // Subaru US
        // 5YJ is Tesla, already listed with BMW US for older VINs. Tesla is more current for 5YJ.
        'YV1': 'VOLVO', 'YV4': 'VOLVO' // Volvo Sweden
        // Add more WMIs as you discover them
    };

    // Maps make names (as identified by wmiToMake) to the ID of the div that should be displayed.
    const makeToDivId = {
        'AUDI': 'audi_div',
        'VOLKSWAGEN': 'audi_div',
        'BENTLEY': 'audi_div',
        'BMW': 'bmw_div',
        'MINI': 'bmw_div',
        'CHRYSLER': 'chrysler_div',
        'JEEP': 'chrysler_div',
        'DODGE': 'chrysler_div',
        'RAM': 'chrysler_div',
        'FIAT': 'chrysler_div',
        'ALFA ROMEO': 'chrysler_div',
        'FORD': 'ford_div',
        'LINCOLN': 'ford_div',
        'MERCURY': 'ford_div',
        'GM': 'gm_div', // Generic GM catch-all
        'CHEVROLET': 'gm_div',
        'GMC': 'gm_div',
        'CADILLAC': 'gm_div',
        'BUICK': 'gm_div',
        'PONTIAC': 'gm_div',
        'OLDSMOBILE': 'gm_div',
        'SATURN': 'gm_div',
        'SAAB': 'gm_div', // Or a separate saab_div if you have specific Saab links
        'HONDA': 'honda_div',
        'ACURA': 'honda_div',
        'HYUNDAI': 'hyundai_div',
        'GENESIS': 'hyundai_div', // Can share with Hyundai or have its own if links differ significantly
        'KIA': 'kia_div',
        'INFINITI': 'infiniti_div',
        'JAGUAR': 'jaguar_div',
        'LAND ROVER': 'landrover_div',
        'LEXUS': 'lexus_div',
        'SCION': 'lexus_div', // Often shares Toyota/Lexus resources
        'MASERATI': 'maserati_div',
        'MAZDA': 'mazda_div',
        'MERCEDES-BENZ': 'mercedes_div',
        'MITSUBISHI': 'mitsubishi_div',
        'NISSAN': 'nissan_div',
        'PORSCHE': 'porsche_div',
        'SUBARU': 'subaru_div',
        'TESLA': 'tesla_div',
        'TOYOTA': 'toyota_div',
        'VOLVO': 'volvo_div',
        'COMMON': 'common_div' // For the common/universal links section
    };

    // Store all unique make-specific div IDs for easy show/hide operations.
    const allMakeDivIds = [...new Set(Object.values(makeToDivId))]; // Using Set to get unique div IDs

    // --- Core Display Functions ---

    /**
     * Hides all make-specific content divs and the common_div.
     */
    window.hideAllMakeSpecificDivs = function() {
        allMakeDivIds.forEach(id => {
            $('#' + id).addClass('d-none');
        });
        $('#identifiedMake').text(''); // Clear identified make text
    };

    /**
     * Shows the relevant make-specific div and hides general links.
     * @param {string} make - The make of the vehicle (e.g., 'FORD', 'BMW').
     */
    window.showMakeSpecificDiv = function(make) {
        hideAllMakeSpecificDivs(); // Hide all first
        const divId = makeToDivId[make.toUpperCase()]; // Ensure make is uppercase for matching
        const commonDivId = makeToDivId['COMMON'];

        if (divId) {
            $('#' + divId).removeClass('d-none');
            $('#identifiedMake').text(`Identified Make: ${make} (Displaying relevant links)`);
            $('#general_links_div').addClass('d-none'); // Hide general links sidebar
            if (commonDivId && divId !== commonDivId) { // Show common_div if it's not the primary one being shown
                $('#' + commonDivId).removeClass('d-none');
            }
        } else {
            $('#identifiedMake').text(`Make "${make}" not recognized or no specific section. Showing general links.`);
            $('#general_links_div').removeClass('d-none'); // Show general links if make not found
            if (commonDivId) { // Still show common_div with general links
                 $('#' + commonDivId).removeClass('d-none');
            }
        }
    };

    /**
     * Updates the display based on manual selection from the dropdown or VIN input.
     * @param {string} makeKey - The make key (e.g., 'AUDI', 'ALL').
     */
    window.updateDisplay = function(makeKey) {
        // Do not clear VIN bar if user is just clicking "Show All General Links"
        if (makeKey !== 'ALL') {
            // $('#VINbar').val(''); // Clearing VIN on manual make selection might be disruptive if user wants to keep VIN
        }
        const commonDivId = makeToDivId['COMMON'];

        if (makeKey === 'ALL' || !makeKey) {
            hideAllMakeSpecificDivs();
            $('#general_links_div').removeClass('d-none'); // Show general links sidebar
            if (commonDivId) { // Show common_div with general links
                 $('#' + commonDivId).removeClass('d-none');
            }
            $('#identifiedMake').text('Showing General & Common Research Links');
        } else {
            showMakeSpecificDiv(makeKey);
        }
    };

    /**
     * Handles real-time input in the VIN bar to attempt make identification.
     */
    window.handleVinInput = function() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        const commonDivId = makeToDivId['COMMON'];

        if (vinValue.length === 0) {
            updateDisplay('ALL'); // Show general links if VIN is cleared
            return;
        }

        if (vinValue.length >= 3) { // Attempt to identify make after 3 chars
            const make = getMakeFromVin(vinValue);
            if (make) {
                showMakeSpecificDiv(make);
            } else {
                // If VIN is partially entered but make not ID'd yet
                $('#identifiedMake').text(`Typing VIN: ${vinValue.substring(0,3)}... (Make not yet identified)`);
                hideAllMakeSpecificDivs(); // Hide specific make divs
                $('#general_links_div').removeClass('d-none'); // Show general links
                 if (commonDivId) { $('#' + commonDivId).removeClass('d-none'); } // Show common links
            }
        } else {
            // VIN is too short to identify make
            $('#identifiedMake').text('Enter at least 3 characters of VIN...');
            hideAllMakeSpecificDivs(); // Hide specific make divs
            $('#general_links_div').removeClass('d-none'); // Show general links
            if (commonDivId) { $('#' + commonDivId).removeClass('d-none'); } // Show common links
        }
    };

    /**
     * Processes the full VIN on submission (button click or Enter).
     * Fetches NHTSA data if the function is available.
     */
    window.processVinAndDisplay = function() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        $('#VINbar').val(vinValue); // Ensure it's uppercase in the bar

        if (vinValue.length !== 17) {
            $('#output').html("<strong>Validation Error:</strong> Please enter a full 17-digit VIN.");
            $('#outputbox').fadeIn();
            // Do not automatically fade out error messages that require user action/correction
            // setTimeout(() => $('#outputbox').fadeOut(), 3000); 
            updateDisplay('ALL'); // Revert to general links if VIN is invalid
            return;
        }

        const make = getMakeFromVin(vinValue);
        if (make) {
            showMakeSpecificDiv(make);
            $('#output').html(`Displaying links for identified make: <strong>${make}</strong>.`);
            $('#outputbox').fadeIn().delay(2500).fadeOut(); // Slightly longer display for confirmation
        } else {
            $('#output').html(`<strong>Notice:</strong> Make not identified for this VIN. Showing general research links.`);
            $('#outputbox').fadeIn().delay(3500).fadeOut();
            updateDisplay('ALL'); // Revert to general links
        }

        // Attempt to fetch NHTSA data if the function exists
        if (typeof getNHTSADataByVIN === "function") {
            getNHTSADataByVIN(vinValue);
        } else {
            console.warn("getNHTSADataByVIN function is not defined. NHTSA data will not be fetched.");
        }
    };

    /**
     * Retrieves the make from the VIN using the WMI.
     * @param {string} vin - The vehicle identification number.
     * @returns {string|null} The identified make or null.
     */
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
        if (e.which == 13) { // Enter key pressed
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
                (document.getElementById("imake").value ? "/" + document.getElementById("imake").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") + // Handle spaces and '&'
                (document.getElementById("imodel").value ? "/" + document.getElementById("imodel").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") +
                (document.getElementById("itrim").value ? "/" + document.getElementById("itrim").value.replace(/ & /g, "-and-").replace(/ /g, "-") : "") +
                (tcyl ? "/" + tcyl : "") +
                (favorite.length > 0 ? "/" + favorite.join("/") : "") +
                "?zip=21162&sort=4&distance=all"; 
            window.open(carmaxUrl, '_blank');
        };
    }
    
    // --- Make-Specific Link Functions & JSON Fetch Helper ---

    function getVinOrAlert() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        if (vinValue.length === 17) {
            return vinValue;
        } else {
            $('#output').html("<strong>VIN Required:</strong> Please enter a valid 17-digit VIN before using this link.");
            $('#outputbox').stop().fadeIn(); // Ensure it's visible
            return null;
        }
    }

    /**
     * Attempts to fetch and display JSON data from a given URL.
     * Provides a fallback direct link if fetching fails (e.g., due to CORS).
     * @param {string} url - The URL to fetch JSON from.
     * @param {string} makeName - The name of the make for display purposes.
     */
    function attemptJsonFetch(url, makeName) {
        $('#output').html(`Attempting to fetch ${makeName} data... <small>(May be blocked by browser or API changes)</small>`);
        $('#outputbox').stop().fadeIn();
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    // Try to get more info from response if possible, even if not strictly JSON error
                    let errorDetail = `Network response was not ok: ${response.status} ${response.statusText}`;
                    if (response.type === 'opaque') { // Opaque responses are common with 'no-cors' mode, but we are not using it here. Still, good to know.
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
                // Provide a more user-friendly message with a direct link
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

    // --- Individual Make/Link Functions (using getVinOrAlert and attemptJsonFetch where appropriate) ---
    window.vwaudilane = function () { const vin = getVinOrAlert(); if (vin) window.open('http://webtest1.audi.com.edgesuite.net/acf012/v1/applications/vindecoder/default/details/' + vin + '/CA/EN', '_blank'); };
    window.bimmerbtn = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.mdecoder.com/decode/' + vin, '_blank'); };
    window.bmwlane = function () { const vin = getVinOrAlert(); if (vin) window.open('http://www.nadeauto.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin + '&make=BMW&img=1', '_blank'); };
    window.miniog = function() {
        var myear = $("#myear").val(); var mmodel = $("#mmodel").val();
        if(myear && mmodel) { window.open('https://www.google.com/search?q=' + encodeURIComponent(myear + ' ' + mmodel + ' mini cooper ordering guide site:minif56.com'), '_blank'); } 
        else { alert("Please enter Year and Model for MINI Guide Search."); }
    };
    window.chrysler = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.chrysler.com/hostd/windowsticker/getWindowStickerPdf.do?vin=' + vin, '_blank'); };
    window.chryslerlist = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.jeep.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank'); };
    window.chryslerlist2 = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.ramtrucks.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank'); };
    window.chryslerlist3 = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.dodge.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank'); };
    window.fordwiki = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.windowsticker.forddirect.com/windowsticker.pdf?vin=' + vin, '_blank'); };
    window.ford = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.motorcraftservice.com/Home/SetCountry?returnUrl=%2FAsBuilt%3Fvin%3D' + vin, '_blank'); };
    window.fordsticker = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.inventory.ford.com/services/inventory/v2/windowsticker/' + vin + '?dealerId=XXXXX', '_blank'); };
    window.fordstickerkey = function () { const vin = getVinOrAlert(); if (vin) window.open('https://api.concentrix.ford.com/v1.0/vehicle/vin/' + vin + '/details', '_blank'); };
    window.fordstickerkey2 = function () {
        const vin = getVinOrAlert(); const mkey = $('#mkey').val().trim();
        if (vin && mkey.length > 0) { let url = 'https://api.concentrix.ford.com/v1.0/vehicle/vin/' + vin + '/details'; alert("Opening Concentrix URL. Authentication/headers may be required: " + url + " with key: " + mkey); window.open(url, '_blank'); } 
        else if (vin && mkey.length === 0) { alert("Please enter the Concentrix key."); }
    };
    window.gmlink2 = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.gmpartsrebates.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin, '_blank'); };
    window.gmlink = function () { const vin = getVinOrAlert(); if (vin) window.open('https://www.gmremarketing.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin + '&make=SAAB', '_blank'); };
    
    window.honda2 = function () { const vin = getVinOrAlert(); if (vin) attemptJsonFetch('https://www.hondaautomobileparts.com/json/vars.aspx?vin=' + vin + '&dl=true', 'Honda'); };
    window.acura = function () { const vin = getVinOrAlert(); if (vin) attemptJsonFetch('https://www.acuraautomobileparts.com/json/vars.aspx?vin=' + vin + '&dl=true', 'Acura'); };
    window.hyunwiki = function () { const vin = getVinOrAlert(); if (vin) attemptJsonFetch('https://www.hyundaiusa.com/var/hyundai/services/inventory/vehicleDetailsByVin.json?vin=' + vin, 'Hyundai'); };
    
    window.getnissansticker4 = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.nissanusa.com/owners/forms/window-sticker-lookup.html?vin=' + vin, '_blank'); };
    window.infiniti = function() { const vin = getVinOrAlert(); if(vin) { alert("Infiniti specific sticker link pattern needs verification. Opening general lookup."); window.open('https://www.infinitiusa.com/owners/ownership/manuals-guides.html', '_blank'); } };
    window.infinititrm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.infinitiusa.com/owners/vehicle-resources/recall-information.html?dcp=sn_258_RECALLS&uuid=ONLINE_SEARCH_FORM&vin=' + vin, '_blank'); };
    window.kiabtn2 = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.kia.com/us/en/services/kia-owner-portal/information?vin=' + vin, '_blank'); };
    window.maserati = function() { const vin = getVinOrAlert(); if(vin) { alert("Maserati window sticker links are typically dealer-specific. Searching Google for dealer inventory."); window.open('https://www.google.com/search?q=maserati+dealer+inventory+window+sticker+' + vin, '_blank'); } };
    window.mazdabtn2 = function() { alert("Mazda alternate window sticker link is currently unavailable (as per original notes)."); };
    window.mazdabtn = function() { const vin = getVinOrAlert(); if(vin) { alert("Mazda dealer inventory sticker link needs specific dealer portal. Searching Google."); window.open('https://www.google.com/search?q=mazda+dealer+inventory+window+sticker+' + vin, '_blank'); } };
    window.decoderz = function() { const vin = getVinOrAlert(); if(vin) window.open('https://vindecoderz.com/EN/check-lookup/' + vin, '_blank'); };
    window.mitsbtn = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.mitsubishicars.com/owners/service/recalls?vin=' + vin, '_blank'); };
    window.nissan = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.nissanusa.com/owners/forms/window-sticker-lookup.html?vin=' + vin, '_blank'); };
    window.nissantrm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.nissanusa.com/owners/vehicle-resources/recall-lookup.html?vin=' + vin, '_blank'); };
    window.porwiki = function() { const vin = getVinOrAlert(); if(vin) { alert("Porsche window sticker links are typically dealer-specific or require login. Searching Porsche USA."); window.open('https://www.porsche.com/usa/accessoriesandservices/porscheservice/vehicleinformation/originalvehicleinformation/', '_blank'); } };
    window.subaru2 = function() { const vin = getVinOrAlert(); if (vin) { alert("Subaru JSON trim link pattern needs verification. Opening recall site."); window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank'); } };
    window.subaru = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank'); };
    window.subarusticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.subaruwindowsticker.com/parse.php?vin=' + vin, '_blank'); };
    window.tesla = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.tesla.com/vin/' + vin, '_blank'); };
    window.teslam = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.tesla.com/ownersmanual', '_blank'); };
    window.tesla2 = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.google.com/search?q=tesla+vin+' + vin + '+for+sale+history', '_blank'); };
    window.toyotasticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://api.toyotainventory.com/vehicles/' + vin + '/monroney', '_blank'); };
    window.toyotasticker3 = function() { const vin = getVinOrAlert(); if(vin) { alert("DealerSocket/DealerFire Toyota sticker links vary by dealer. Searching Google."); window.open('https://www.google.com/search?q=toyota+dealersocket+window+sticker+' + vin, '_blank'); } };
    window.volvosticker = function() { const vin = getVinOrAlert(); if(vin) window.open('https://volvo.custhelp.com/app/answers/detail/a_id/9005/~/how-do-i-get-a-window-sticker-%28monroney-label%29-for-my-volvo%3F', '_blank'); };
    
    window.velocitysticker = function() { const vin = getVinOrAlert(); if(vin) alert("Velocity sticker link requires dealer login/access. This is a placeholder."); };
    window.autobrochures = function() { window.open('http://www.auto-brochures.com/', '_blank'); };
    window.manheimmmr = function() { const vin = getVinOrAlert(); if(vin) window.open('https://mmr.manheim.com/#!/vdp?vin=' + vin, '_blank'); };
    window.hclutch = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.vehiclehistory.com/vehicle/history-report-by-vin/' + vin, '_blank'); };
    window.siriusxm = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.siriusxm.com/vehicleavailability?vin=' + vin, '_blank'); };
    window.hitcher = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.etrailer.com/vehicle-fit-guide.aspx?vin=' + vin, '_blank'); };
    
    window.invoice = function() { const vin = getVinOrAlert(); if(vin) window.open('http://www.blackbookportals.com/bb/products/newcarhtmlportal.asp?color=o&companyid=MAYO&vin=' + vin, '_blank'); };
    window.bidhistory = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.bidhistory.com/search?q=' + vin, '_blank'); };
    window.manheimsearch = function() { const vin = getVinOrAlert(); if(vin) window.open('https://www.manheim.com/members/search_results?vin=' + vin, '_blank'); };

    // --- NHTSA Data Fetching Function ---
    window.getNHTSADataByVIN = function(vinToQuery) {
        $('#txt_results').val(`Fetching NHTSA data for VIN: ${vinToQuery}...`);
        const nhtsaApiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vinToQuery}?format=json`;

        fetch(nhtsaApiUrl)
            .then(response => {
                if (!response.ok) { throw new Error(`NHTSA API response error: ${response.status} ${response.statusText}`); }
                return response.json();
            })
            .then(data => {
                if (data && data.Results && data.Results.length > 0) {
                    let formattedResults = `NHTSA Decoded VIN: ${vinToQuery}\n\n`;
                    const vehicleData = data.Results[0];
                    const fieldsToShow = ['Make', 'Model', 'ModelYear', 'Manufacturer', 'VehicleType', 'BodyClass', 'DriveType', 'EngineCylinders', 'FuelTypePrimary', 'PlantCity', 'PlantCountry'];
                    fieldsToShow.forEach(field => {
                        if (vehicleData[field]) {
                            formattedResults += `${field.replace(/([A-Z])/g, ' $1').trim()}: ${vehicleData[field]}\n`; // Add space before caps
                        }
                    });
                    $('#txt_results').val(formattedResults.trim());
                } else {
                    $('#txt_results').val(`No detailed results from NHTSA for VIN: ${vinToQuery}. Message: ${data.Message || ''}`);
                }
            })
            .catch(error => {
                console.error("Error fetching NHTSA data:", error);
                $('#txt_results').val(`Error fetching NHTSA data for VIN: ${vinToQuery}.\n${error.message}`);
            });
    };

    updateDisplay('ALL'); 
});
