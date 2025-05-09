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
        $('#VINbar').val(''); // Clear VIN bar when using manual select for a specific make
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
            $('#output').text("Please enter a full 17-digit VIN.");
            $('#outputbox').fadeIn();
            setTimeout(() => $('#outputbox').fadeOut(), 3000);
            updateDisplay('ALL'); // Revert to general links if VIN is invalid
            return;
        }

        const make = getMakeFromVin(vinValue);
        if (make) {
            showMakeSpecificDiv(make);
            $('#output').text(`Displaying links for identified make: ${make}.`);
            $('#outputbox').fadeIn().delay(2000).fadeOut();
        } else {
            $('#output').text(`Make not identified for VIN. Showing general links.`);
            $('#outputbox').fadeIn().delay(3000).fadeOut();
            updateDisplay('ALL'); // Revert to general links
        }

        // Attempt to fetch NHTSA data if the function exists
        if (typeof getNHTSADataByVIN === "function") {
            getNHTSADataByVIN(vinValue);
        } else {
            console.warn("getNHTSADataByVIN function is not defined. NHTSA data will not be fetched.");
            // Optionally, display a message in the outputbox if NHTSA fetching is a core feature.
            // $('#output').append("<br>NHTSA data fetching is currently unavailable.");
            // $('#outputbox').fadeIn();
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
    // Attach event listener to the search button for explicit VIN processing
    $('#btn_submit').on('click', processVinAndDisplay);

    // Also allow Enter key in VIN bar to trigger processing
    $('#VINbar').on('keypress', function(e) {
        if (e.which == 13) { // Enter key pressed
            processVinAndDisplay();
            e.preventDefault(); // Prevent default form submission if it were in a form
        }
    });

    // CarMax search button functionality (from original inline script)
    if (document.getElementById("kmxbutton")) {
        document.getElementById("kmxbutton").onclick = function () {
            var favorite = [];
            $.each($("input[name='options']:checked"), function () {
                favorite.push($(this).val());
            });
            var tcyl = document.getElementById("icyl").value ? "cylinders-" + document.getElementById("icyl").value : "";
            var carmaxUrl = "https://www.carmax.com/cars" +
                (document.getElementById("iyear").value ? "/" + document.getElementById("iyear").value : "") +
                (document.getElementById("imake").value ? "/" + document.getElementById("imake").value.replace(/ /g, "-") : "") +
                (document.getElementById("imodel").value ? "/" + document.getElementById("imodel").value.replace(/ /g, "-") : "") +
                (document.getElementById("itrim").value ? "/" + document.getElementById("itrim").value.replace(/ /g, "-") : "") +
                (tcyl ? "/" + tcyl : "") +
                (favorite.length > 0 ? "/" + favorite.join("/") : "") +
                "?zip=21162&sort=4&distance=all"; // Ensure your default ZIP and params are correct
            window.open(carmaxUrl, '_blank');
        };
    }

    // Animated GIF movement (from original inline script)
    // This was for an element #dancebk, but the image ID in HTML is dancebkstatic.
    // If you intend to have a separate, perhaps absolutely positioned, #dancebk element for animation,
    // ensure it exists in your HTML. Otherwise, this won't do anything.
    // For now, I'll comment it out to prevent potential errors if #dancebk doesn't exist.
    /*
    if ($("#dancebk").length) { // Check if #dancebk exists
         $(document).mousemove(function (e) {
            $("#dancebk").stop().animate({ left: e.pageX + 8, top: e.pageY + 15 });
         });
    }
    */

    // --- Make-Specific Link Functions ---
    // These functions are called by onclick attributes in the HTML.
    // They generally open a new window/tab with a URL constructed using the current VIN.

    function getVinOrAlert() {
        const vinValue = $('#VINbar').val().trim().toUpperCase();
        if (vinValue.length === 17) {
            return vinValue;
        } else {
            alert("Please enter a valid 17-digit VIN.");
            return null;
        }
    }

    window.vwaudilane = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('http://webtest1.audi.com.edgesuite.net/acf012/v1/applications/vindecoder/default/details/' + vin + '/CA/EN', '_blank');
    };
    window.bimmerbtn = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.mdecoder.com/decode/' + vin, '_blank');
    };
    window.bmwlane = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('http://www.nadeauto.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin + '&make=BMW&img=1', '_blank');
    };
    window.miniog = function() {
        var myear = $("#myear").val();
        var mmodel = $("#mmodel").val();
        if(myear && mmodel) {
            window.open('https://www.google.com/search?q=' + encodeURIComponent(myear + ' ' + mmodel + ' mini cooper ordering guide site:minif56.com'), '_blank');
        } else {
            alert("Please enter Year and Model for MINI Guide Search.");
        }
    };
    window.chrysler = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.chrysler.com/hostd/windowsticker/getWindowStickerPdf.do?vin=' + vin, '_blank');
    };
    window.chryslerlist = function () { // Jeep Build Sheet
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.jeep.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank');
    };
    window.chryslerlist2 = function () { // RAM Build Sheet
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.ramtrucks.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank');
    };
    window.chryslerlist3 = function () { // Dodge Build Sheet
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.dodge.com/webselfservice/BuildSheetServlet?vin=' + vin, '_blank');
    };
    window.fordwiki = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.windowsticker.forddirect.com/windowsticker.pdf?vin=' + vin, '_blank');
    };
    window.ford = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.motorcraftservice.com/Home/SetCountry?returnUrl=%2FAsBuilt%3Fvin%3D' + vin, '_blank');
    };
    window.fordsticker = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.inventory.ford.com/services/inventory/v2/windowsticker/' + vin + '?dealerId=XXXXX', '_blank'); // Dealer ID might be needed
    };
    window.fordstickerkey = function () { // Concentrix JSON
        const vin = getVinOrAlert();
        if (vin) window.open('https://api.concentrix.ford.com/v1.0/vehicle/vin/' + vin + '/details', '_blank');
    };
    window.fordstickerkey2 = function () { // Concentrix with key input
        const vin = getVinOrAlert();
        const mkey = $('#mkey').val().trim();
        if (vin && mkey.length > 0) {
            let url = 'https://api.concentrix.ford.com/v1.0/vehicle/vin/' + vin + '/details';
            // This would typically be an AJAX request if you could process the JSON and add headers.
            // For now, just opening the URL. User will need to handle auth/headers in browser if possible or use Postman.
            alert("Opening Concentrix URL. Authentication/headers may be required: " + url + " with key: " + mkey);
            window.open(url, '_blank');
        } else if (vin && mkey.length === 0) {
            alert("Please enter the Concentrix key.");
        }
    };
    window.gmlink2 = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.gmpartsrebates.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin, '_blank');
    };
    window.gmlink = function () {
        const vin = getVinOrAlert();
        if (vin) window.open('https://www.gmremarketing.com/MonroneySticker/MonroneyStickerRequestHandler.ashx?vin=' + vin + '&make=SAAB', '_blank'); // Example with make, adjust if needed
    };
    window.honda2 = function () { // Honda Trim Level JSON
        const vin = getVinOrAlert();
        if (vin) {
            let url = 'https://www.hondaautomobileparts.com/json/vars.aspx?vin=' + vin + '&dl=true';
            attemptJsonFetch(url, 'Honda');
        }
    };
    window.acura = function () { // Acura Trim Level JSON
        const vin = getVinOrAlert();
        if (vin) {
            let url = 'https://www.acuraautomobileparts.com/json/vars.aspx?vin=' + vin + '&dl=true';
            attemptJsonFetch(url, 'Acura');
        }
    };
    window.hyunwiki = function () { // Hyundai Details JSON
        const vin = getVinOrAlert();
        if (vin) {
            let url = 'https://www.hyundaiusa.com/var/hyundai/services/inventory/vehicleDetailsByVin.json?vin=' + vin;
            attemptJsonFetch(url, 'Hyundai');
        }
    };
    window.getnissansticker4 = function() { // Used by Infiniti and Nissan
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.nissanusa.com/owners/forms/window-sticker-lookup.html?vin=' + vin, '_blank'); // This is a lookup page, not direct PDF
    };
    window.infiniti = function() { // Alternative Infiniti sticker
        const vin = getVinOrAlert();
        // This URL pattern might be outdated or require specific conditions.
        // Example: 'https://www.infinitiusa.com/window-sticker/' + vin + '.pdf' - verify correct pattern
        if(vin) alert("Infiniti specific sticker link pattern needs verification. Opening general lookup.");
        if(vin) window.open('https://www.infinitiusa.com/owners/ownership/manuals-guides.html', '_blank'); // General owner page
    };
    window.infinititrm = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.infinitiusa.com/owners/vehicle-resources/recall-information.html?dcp=sn_258_RECALLS&uuid=ONLINE_SEARCH_FORM&vin=' + vin, '_blank');
    };
    window.kiabtn2 = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.kia.com/us/en/services/kia-owner-portal/information?vin=' + vin, '_blank'); // Points to owner portal, sticker might be there
    };
    window.maserati = function() {
        const vin = getVinOrAlert();
        // Maserati sticker links are often dealer-specific or require login.
        if(vin) alert("Maserati window sticker links are typically dealer-specific. Searching Google for dealer inventory.");
        if(vin) window.open('https://www.google.com/search?q=maserati+dealer+inventory+window+sticker+' + vin, '_blank');
    };
    window.mazdabtn2 = function() { alert("Mazda alternate window sticker link is currently unavailable (as per original notes)."); };
    window.mazdabtn = function() {
        const vin = getVinOrAlert();
        if(vin) alert("Mazda dealer inventory sticker link needs specific dealer portal. Searching Google.");
        if(vin) window.open('https://www.google.com/search?q=mazda+dealer+inventory+window+sticker+' + vin, '_blank');
    };
    window.decoderz = function() { // Generic VIN decoder
        const vin = getVinOrAlert();
        if(vin) window.open('https://vindecoderz.com/EN/check-lookup/' + vin, '_blank');
    };
    window.mitsbtn = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.mitsubishicars.com/owners/service/recalls?vin=' + vin, '_blank'); // Recall site might show trim
    };
    window.nissan = function() { // Alternative Nissan sticker
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.nissanusa.com/owners/forms/window-sticker-lookup.html?vin=' + vin, '_blank');
    };
    window.nissantrm = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.nissanusa.com/owners/vehicle-resources/recall-lookup.html?vin=' + vin, '_blank');
    };
    window.porwiki = function() {
        const vin = getVinOrAlert();
        // Porsche sticker links are often through specific dealer portals or paid services.
        if(vin) alert("Porsche window sticker links are typically dealer-specific or require login. Searching Porsche USA.");
        if(vin) window.open('https://www.porsche.com/usa/accessoriesandservices/porscheservice/vehicleinformation/originalvehicleinformation/', '_blank');
    };
    window.subaru2 = function() { // Subaru Trim JSON
        const vin = getVinOrAlert();
        if (vin) {
            // This URL pattern might be outdated or require specific conditions.
            // Example: 'https://www.subaru.com/content/static/json/vehicle_data/' + vin + '.json' - verify pattern
            alert("Subaru JSON trim link pattern needs verification. Opening recall site.");
            window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank');
        }
    };
    window.subaru = function() { // Subaru Trim Info
         const vin = getVinOrAlert();
         if(vin) window.open('https://www.subaru.com/owners/vehicle-resources/recalls.html?vin=' + vin, '_blank');
    };
    window.subarusticker = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.subaruwindowsticker.com/parse.php?vin=' + vin, '_blank'); // Third-party site
    };
    window.tesla = function() { // Tesla Packages
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.tesla.com/vin/' + vin, '_blank'); // Tesla VIN lookup page
    };
    window.teslam = function() { // Tesla Owner's Manual
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.tesla.com/ownersmanual', '_blank'); // General manuals page
    };
    window.tesla2 = function() { // Tesla Listing Info
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.google.com/search?q=tesla+vin+' + vin + '+for+sale+history', '_blank');
    };
    window.toyotasticker = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://api.toyotainventory.com/vehicles/' + vin + '/monroney', '_blank'); // API based, might change
    };
    window.toyotasticker3 = function() {
        const vin = getVinOrAlert();
        // DealerSocket/DealerFire links are highly variable and specific to dealer sites.
        if(vin) alert("DealerSocket/DealerFire Toyota sticker links vary by dealer. Searching Google.");
        if(vin) window.open('https://www.google.com/search?q=toyota+dealersocket+window+sticker+' + vin, '_blank');
    };
    window.volvosticker = function() {
        const vin = getVinOrAlert();
        // Volvo sticker links can be tricky. This is a common pattern but might not always work.
        if(vin) window.open('https://volvo.custhelp.com/app/answers/detail/a_id/9005/~/how-do-i-get-a-window-sticker-%28monroney-label%29-for-my-volvo%3F', '_blank'); // Info page
    };

    // --- Common/Universal Link Functions ---
    window.velocitysticker = function() {
        const vin = getVinOrAlert();
        if(vin) alert("Velocity sticker link requires dealer login/access. This is a placeholder.");
        // Example: if(vin) window.open('DEALER_VELOCITY_URL_WITH_VIN=' + vin, '_blank');
    };
    window.autobrochures = function() { window.open('http://www.auto-brochures.com/', '_blank'); };
    window.manheimmmr = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://mmr.manheim.com/#!/vdp?vin=' + vin, '_blank');
    };
    window.hclutch = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.vehiclehistory.com/vehicle/history-report-by-vin/' + vin, '_blank'); // Example, verify Clutch.com's current URL structure
    };
    window.siriusxm = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.siriusxm.com/vehicleavailability?vin=' + vin, '_blank');
    };
    window.hitcher = function() { // e-Trailer
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.etrailer.com/vehicle-fit-guide.aspx?vin=' + vin, '_blank');
    };

    // --- Right Sidebar Link Functions ---
    window.invoice = function() { // Blackbook Invoice Guide
        const vin = getVinOrAlert();
        if(vin) window.open('http://www.blackbookportals.com/bb/products/newcarhtmlportal.asp?color=o&companyid=MAYO&vin=' + vin, '_blank'); // Example, may need specific portal
    };
    window.bidhistory = function() { // Copart/Bidhistory
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.bidhistory.com/search?q=' + vin, '_blank');
    };
    window.manheimsearch = function() {
        const vin = getVinOrAlert();
        if(vin) window.open('https://www.manheim.com/members/search_results?vin=' + vin, '_blank');
    };

    /**
     * Attempts to fetch and display JSON data from a given URL.
     * @param {string} url - The URL to fetch JSON from.
     * @param {string} makeName - The name of the make for display purposes.
     */
    function attemptJsonFetch(url, makeName) {
        $('#output').html(`Attempting to fetch ${makeName} data... <small>(May be blocked by browser CORS policy or API changes)</small>`);
        $('#outputbox').fadeIn();
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`${makeName} Data Received:`, data);
                $('#output').html(`<strong>${makeName} Data Received (JSON):</strong><br><pre>${JSON.stringify(data, null, 2)}</pre>`);
                $('#outputbox').stop().fadeIn(); // Ensure it's visible if it was fading out
            })
            .catch(error => {
                console.error(`Error fetching ${makeName} data:`, error);
                $('#output').html(`<strong>Error fetching ${makeName} data.</strong><br><small>This could be due to browser CORS policy, the API being unavailable/changed, or a network issue. Check the console for details.</small><br><small>URL: ${url}</small>`);
                $('#outputbox').stop().fadeIn();
            });
    }

    // --- NHTSA Data Fetching Function (Placeholder) ---
    // The actual implementation of this function would make an API call to NHTSA.
    // This is a placeholder. You'll need to implement the actual API call logic.
    window.getNHTSADataByVIN = function(vinToQuery) {
        console.log("Attempting to fetch NHTSA data for VIN:", vinToQuery);
        $('#txt_results').val(`NHTSA data for VIN: ${vinToQuery} would be fetched here.\n(Actual API call needs implementation)`);

        // Example of how you might use the vPIC API (client-side fetch)
        // Note: The official recommendation is often to use this API server-side to avoid exposing API keys if required,
        // and to handle rate limits. For basic public data, client-side can work.
        const nhtsaApiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vinToQuery}?format=json`;

        fetch(nhtsaApiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`NHTSA API response was not ok: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("NHTSA Data:", data);
                if (data && data.Results && data.Results.length > 0) {
                    let formattedResults = `NHTSA Decoded VIN: ${vinToQuery}\n\n`;
                    // Extract and format relevant data from data.Results[0]
                    const vehicleData = data.Results[0];
                    formattedResults += `Make: ${vehicleData.Make || 'N/A'}\n`;
                    formattedResults += `Model: ${vehicleData.Model || 'N/A'}\n`;
                    formattedResults += `Year: ${vehicleData.ModelYear || 'N/A'}\n`;
                    formattedResults += `Manufacturer: ${vehicleData.Manufacturer || 'N/A'}\n`;
                    formattedResults += `Vehicle Type: ${vehicleData.VehicleType || 'N/A'}\n`;
                    // Add more fields as needed
                    $('#txt_results').val(formattedResults);
                } else {
                    $('#txt_results').val(`No detailed results from NHTSA for VIN: ${vinToQuery}`);
                }
            })
            .catch(error => {
                console.error("Error fetching NHTSA data:", error);
                $('#txt_results').val(`Error fetching NHTSA data for VIN: ${vinToQuery}.\n${error.message}`);
            });
    };


    // --- Initial Page Setup ---
    updateDisplay('ALL'); // Show general links and common_div by default on page load.

}); // End of $(document).ready()
