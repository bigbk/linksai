// Global variables
var currentImageIndex = 1; // Tracks the currently displayed main image number
var currentStockNumber = ''; // Stores the 8-digit stock number
const MAX_THUMBNAILS = 8; // Number of thumbnails to display
const CARMAX_BASE_IMAGE_URL = 'https://img2.carmax.com/img/vehicles/';
const CARMAX_FALLBACK_URL_SNIPPET = '/fallback.jpg'; // CarMax's generic "no image" placeholder
const PLACEHOLDER_MAIN_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available';
const PLACEHOLDER_THUMBNAIL = 'https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A';
const INITIAL_PLACEHOLDER_IMAGE = 'https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23'; // For initial load

// --- Helper Functions ---

/**
 * Toggles the visibility of the Bootstrap spinner modal.
 * @param {boolean} show - True to show the spinner, false to hide.
 */
function toggleSpinner(show) {
    if (show) {
        // Ensure modal is instantiated if not already
        if (!($('#spinnerModal').data('bs.modal'))) {
            new bootstrap.Modal(document.getElementById('spinnerModal'));
        }
        $('#spinnerModal').modal('show');
    } else {
        // Use a small delay to ensure modal has time to show/hide smoothly
        setTimeout(function() { $('#spinnerModal').modal('hide'); }, 100);
    }
}

/**
 * Updates the main display image and triggers thumbnail regeneration.
 * @param {number} imageIndex - The index of the image to display (e.g., 1, 2, 3...).
 */
function displayImage(imageIndex) {
    const mainImageElement = document.getElementById('dispframe');
    const zoomedImageElement = document.getElementById('zoomedImage');

    // If no stock number is set, display initial placeholder and instructions
    if (!currentStockNumber) {
        $('#instructions').show().html('<p><strong>Enter Stock #</strong></p>');
        mainImageElement.src = INITIAL_PLACEHOLDER_IMAGE;
        mainImageElement.alt = 'Enter Stock Number';
        $(mainImageElement).removeClass('no-image-available'); // Ensure no error state class
        zoomedImageElement.src = INITIAL_PLACEHOLDER_IMAGE;
        $(zoomedImageElement).removeClass('no-image-available');
        $('#thumbnail-container').empty(); // Clear thumbnails as there's no stock to generate them for
        $('#kmxlink').attr('href', '#');
        return; // Exit function early
    }

    currentImageIndex = Math.max(1, imageIndex); // Ensure index is at least 1

    toggleSpinner(true); // Show spinner while loading

    const newImageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg`;

    // Clear previous errors/onload to prevent multiple calls
    mainImageElement.onerror = null;
    mainImageElement.onload = null;

    // Load the new image for both main display and zoom modal
    mainImageElement.src = newImageUrl;
    mainImageElement.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    zoomedImageElement.src = newImageUrl;
    zoomedImageElement.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;

    // Handle main image loading success
    mainImageElement.onload = function() {
        toggleSpinner(false); // Hide spinner on load

        // Check for CarMax's tiny fallback images
        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            console.log(`Main image ${currentImageIndex} for ${currentStockNumber} is a tiny fallback/missing.`);
            this.src = PLACEHOLDER_MAIN_IMAGE;
            this.classList.add('no-image-available');
            zoomedImageElement.src = PLACEHOLDER_MAIN_IMAGE; // Update zoomed image to placeholder too
            zoomedImageElement.classList.add('no-image-available');
        } else {
            this.classList.remove('no-image-available');
            zoomedImageElement.classList.remove('no-image-available');
        }
        updateThumbnails(); // Always update thumbnails after main image loads
    };

    // Handle main image loading error (e.g., network error, 404)
    mainImageElement.onerror = function() {
        console.error(`Error loading main image: ${newImageUrl}. Setting to fallback placeholder.`);
        this.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error'; // Local placeholder for general errors
        this.classList.add('no-image-available');
        zoomedImageElement.src = 'https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error'; // Update zoomed image to error placeholder
        zoomedImageElement.classList.add('no-image-available');
        toggleSpinner(false);
    };

    // Update CarMax page link
    $('#kmxlink').attr('href', `https://www.carmax.com/car/${currentStockNumber}`);
    $('#instructions').hide(); // Hide instructions once search starts
}

/**
 * Updates the existing thumbnail image elements in the DOM.
 */
function updateThumbnails() {
    // Determine the range of thumbnails to show
    let startThumbIndex = Math.max(1, currentImageIndex - Math.floor(MAX_THUMBNAILS / 2));
    let endThumbIndex = startThumbIndex + MAX_THUMBNAILS;

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const thumbNum = startThumbIndex + i;
        const thumbImg = $(`#thumb${i + 1}`); // Get the pre-existing thumbnail image element

        if (thumbImg.length === 0) { // If for some reason a thumbnail slot doesn't exist, skip
            continue;
        }

        const thumbnailUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${thumbNum}.jpg?width=100&height=75&fm=webp`;

        // Reset handlers and set new source
        thumbImg[0].onerror = null;
        thumbImg[0].onload = null;
        thumbImg.attr('src', thumbnailUrl).attr('alt', `Thumbnail ${thumbNum} for Stock #${currentStockNumber}`).data('image-index', thumbNum);

        // Highlight active thumbnail
        if (thumbNum === currentImageIndex) {
            thumbImg.addClass('active-thumbnail');
        } else {
            thumbImg.removeClass('active-thumbnail');
        }

        // Error handling for thumbnails
        thumbImg[0].onload = function() {
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add('no-image-available');
            } else {
                this.classList.remove('no-image-available');
            }
        };

        thumbImg[0].onerror = function() {
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add('no-image-available');
        };
    }
}

// --- Navigation Functions ---

function prvs() {
    // Only navigate if there's a stock number loaded and we're not already at the first image
    if (currentStockNumber && currentImageIndex > 1) {
        displayImage(currentImageIndex - 1);
    }
}

function nxt() {
    // Only navigate if there's a stock number loaded
    if (currentStockNumber) {
        displayImage(currentImageIndex + 1);
    }
}

// --- Search Handlers ---

document.getElementById("btn_submit").onclick = function () {
    const vinBar = document.getElementById("VINbar");
    const inputStockNum = vinBar.value.trim();

    if (inputStockNum.length === 8) {
        currentStockNumber = inputStockNum;
        currentImageIndex = 1; // Always start with the first image for a new stock number
        displayImage(currentImageIndex);
    } else {
        $('#instructions').show().html(`<strong>Invalid Stock Number:</strong> Must be 8 digits. You entered ${inputStockNum.length} digits.`);
        $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Invalid Stock Number'); // Keep initial placeholder
        $('#thumbnail-container').empty(); // Clear thumbnails
        $('#kmxlink').attr('href', '#');
        currentStockNumber = ''; // Clear stock number on invalid input
    }
};

document.getElementById("btn_submit2").onclick = function () {
    let linkBarValue = document.getElementById("LINKbar").value.trim();

    if (linkBarValue) {
        // Regex to extract 8-digit stock number and optional image index from CarMax URLs
        const carmaxUrlRegex = /(?:vehicles|img)\/(\d{8})(?:\/(\d+))?(?:\.jpg|\.webp|\?|$)/i;
        const match = linkBarValue.match(carmaxUrlRegex);

        if (match && match[1]) {
            currentStockNumber = match[1];
            currentImageIndex = parseInt(match[2]) || 1;
            document.getElementById("VINbar").value = currentStockNumber;
            displayImage(currentImageIndex);
        } else {
            $('#instructions').show().html(`<strong>Invalid Image Link:</strong> Please paste a valid CarMax image URL. Example: <br><code>https://img2.carmax.com/img/vehicles/12345678/1.jpg</code>`);
            $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Invalid Link'); // Keep initial placeholder
            $('#thumbnail-container').empty();
            $('#kmxlink').attr('href', '#');
            currentStockNumber = '';
        }
    } else {
        $('#instructions').show().html(`<strong>Please paste a CarMax image link.</strong>`);
    }
};

// --- Event Listeners for Enter Key ---

var inputFields = ["VINbar", "LINKbar"];
inputFields.forEach(function(fieldId) {
    var input = document.getElementById(fieldId);
    input.addEventListener("keyup", function(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById(fieldId === "VINbar" ? "btn_submit" : "btn_submit2").click();
        }
    });
});

// --- Initial Page Load ---
$(document).ready(function() {
    displayImage(currentImageIndex); // Show initial state
});

// Event listener for the main display image to open the zoom modal
$('#dispframe').on('click', function() {
    // Only open the modal if a valid image is displayed (not a placeholder)
    if (!$(this).hasClass('no-image-available') && currentStockNumber) {
        const zoomedImage = document.getElementById('zoomedImage');
        zoomedImage.src = this.src;
        zoomedImage.alt = this.alt;
        $(zoomedImage).removeClass('no-image-available');
        
        // Ensure modal is instantiated if not already
        if (!($('#imageZoomModal').data('bs.modal'))) {
            new bootstrap.Modal(document.getElementById('imageZoomModal'));
        }
        $('#imageZoomModal').modal('show');
    }
});
