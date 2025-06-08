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
        updateThumbnails(); // Still call to ensure placeholders are set/updated if needed
        $('#kmxlink').attr('href', '#');
        return; // Exit function early
    }

    currentImageIndex = Math.max(1, imageIndex); // Ensure index is at least 1

    // Temporarily hide the main image during loading to prevent flicker
    mainImageElement.style.opacity = 0;
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
        mainImageElement.style.opacity = 1; // Fade in main image
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
        mainImageElement.style.opacity = 1; // Still show placeholder
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
    // Aim to center the currentImageIndex among the 8 thumbnails
    let startThumbIndex = Math.max(1, currentImageIndex - Math.floor(MAX_THUMBNAILS / 2));
    // Adjust startThumbIndex if it would cause us to miss the currentImageIndex on the right side of the window
    // This is useful if currentImageIndex is high and the window is short on earlier images.
    // However, without knowing total image count, this can still result in showing past available images.
    // For now, let's keep it simple and ensure currentImageIndex is within range.

    // A simpler way to ensure currentImageIndex is within the displayed range of 8:
    // If currentImageIndex is, say, 1, show 1-8.
    // If currentImageIndex is 5, show 1-8 (as 5 is in range).
    // If currentImageIndex is 6, show 2-9 (to keep 6 visible and shift).
    // If currentImageIndex is 9, show 5-12.

    // This logic ensures `currentImageIndex` is always covered by the `MAX_THUMBNAILS` window,
    // and shifts the window as `currentImageIndex` increases.
    // Start index is such that `currentImageIndex` is roughly in the middle (5th slot).
    startThumbIndex = currentImageIndex - (Math.floor(MAX_THUMBNAILS / 2) - 1); // E.g., for 8, 5th slot, so current - (4-1) = current - 3
    startThumbIndex = Math.max(1, startThumbIndex); // Never go below 1

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const thumbNum = startThumbIndex + i;
        const thumbImg = $(`#thumb${i + 1}`); // Get the pre-existing thumbnail image element

        if (thumbImg.length === 0) {
            console.warn(`Thumbnail slot #thumb${i + 1} not found in HTML.`);
            continue;
        }

        let thumbnailUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${thumbNum}.jpg?width=100&height=75&fm=webp`;
        let isPlaceholder = false;

        // If no stock number, or if thumbNum is less than 1 (shouldn't happen with Math.max(1, ...))
        // or if currentStockNumber is empty (initial load state)
        if (!currentStockNumber || thumbNum < 1) { // Added !currentStockNumber for initial state
            thumbnailUrl = PLACEHOLDER_THUMBNAIL;
            isPlaceholder = true;
        }

        // Reset handlers and set new source
        thumbImg[0].onerror = null;
        thumbImg[0].onload = null;
        thumbImg.attr('src', thumbnailUrl).attr('alt', `Thumbnail ${thumbNum} for Stock #${currentStockNumber}`).data('image-index', thumbNum);

        // Highlight active thumbnail
        if (currentStockNumber && thumbNum === currentImageIndex) { // Only active if stock number is set and it's the current image
            thumbImg.addClass('active-thumbnail');
        } else {
            thumbImg.removeClass('active-thumbnail');
        }

        // Error handling for thumbnails (checks for CarMax's tiny fallback)
        thumbImg[0].onload = function() {
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add('no-image-available');
            } else {
                this.classList.remove('no-image-available');
            }
        };

        // General onerror for network issues or non-CarMax fallbacks
        thumbImg[0].onerror = function() {
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add('no-image-available');
        };

        // If it's explicitly a placeholder (e.g., beyond available images), mark it as unavailable
        if (isPlaceholder) {
             thumbImg.addClass('no-image-available');
        } else {
             // Ensure this class is removed if it's no longer a placeholder
             thumbImg.removeClass('no-image-available');
        }
    }
}

// --- Navigation Functions ---

function prvs() {
    // Only navigate if there's a stock number loaded and we're not already at the first image
    if (currentStockNumber && currentImageIndex > 1) {
        displayImage(currentImageIndex - 1);
    } else if (currentStockNumber && currentImageIndex === 1) {
        console.log("Already at the first image.");
    }
}

function nxt() {
    // Only navigate if there's a stock number loaded. We allow going past existing images
    // as the onerror will correctly display a placeholder if image doesn't exist.
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
        // Ensure main image reverts to initial placeholder on invalid input
        $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Invalid Stock Number');
        currentStockNumber = ''; // Clear stock number on invalid input
        updateThumbnails(); // Update thumbnails to show placeholders
        $('#kmxlink').attr('href', '#');
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
            // Ensure main image reverts to initial placeholder on invalid link
            $('#dispframe').attr('src', INITIAL_PLACEHOLDER_IMAGE).attr('alt', 'Invalid Link');
            currentStockNumber = '';
            updateThumbnails(); // Update thumbnails to show placeholders
            $('#kmxlink').attr('href', '#');
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
