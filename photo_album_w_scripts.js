var currentImageIndex = 1;
var currentStockNumber = "";
let isLoading = false; // Flag to prevent multiple image loads simultaneously

// Removed: spinnerModalInstance variable as modal HTML is removed

const MAX_IMAGE_INDEX = 40;
const MAX_THUMBNAILS = 8; // Number of thumbnail slots in the HTML
const CARMAX_BASE_IMAGE_URL = "https://img2.carmax.com/img/vehicles/";
const PLACEHOLDER_MAIN_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available";
const PLACEHOLDER_THUMBNAIL = "https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A";
const INITIAL_PLACEHOLDER_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23";

// Removed: document.addEventListener('hidden.bs.modal')

// --- REMOVED LOADING MODAL FUNCTIONALITY ---
function toggleSpinner(show) {
    // This function now does nothing, effectively removing the spinner.
    console.log(`[Spinner Debug] toggleSpinner called: ${show ? 'SHOW' : 'HIDE'} (MODAL REMOVED)`);
}
// --- END REMOVED LOADING MODAL FUNCTIONALITY ---


// Display the main image and zoomed image, handle loading states and errors
function displayImage(requestedIndex) {
    console.log(`[displayImage] Called with requestedIndex: ${requestedIndex}, currentStockNumber: ${currentStockNumber}, isLoading: ${isLoading}`);

    if (isLoading) {
        console.log("[displayImage] Aborting: Another image load is already in progress.");
        return;
    }

    isLoading = true; // Set isLoading true at the start of load
    console.log(`[displayImage] isLoading set to true. Current isLoading: ${isLoading}`);

    const mainImage = document.getElementById("dispframe");
    const zoomedImage = document.getElementById("zoomedImage");

    mainImage.style.opacity = 0.5; // Still dim the image for visual feedback during load
    // toggleSpinner(true); // Removed: Call to toggleSpinner

    currentImageIndex = Math.max(1, Math.min(requestedIndex, MAX_IMAGE_INDEX));
    const imageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg`;
    console.log(`[displayImage] Attempting to load image: ${imageUrl}`);

    let loadHandled = false; // To prevent double handling of load/error events

    const timeout = setTimeout(() => {
        if (!loadHandled) { // Only fallback if load/error hasn't already fired
            console.warn("[displayImage] Image load timed out!");
            fallbackImage(`Image took too long to load or is missing for Stock #${currentStockNumber}`);
            loadHandled = true; // Mark as handled
        }
    }, 7000);
    console.log("[displayImage] Timeout set for 7 seconds.");

    function fallbackImage(message) {
        console.log(`[displayImage] fallbackImage called with message: ${message}`);
        mainImage.src = PLACEHOLDER_MAIN_IMAGE;
        zoomedImage.src = PLACEHOLDER_MAIN_IMAGE;
        mainImage.classList.add("no-image-available");
        zoomedImage.classList.add("no-image-available");
        $("#instructions").show().html(`<p><strong>${message}</strong></p>`);
        // toggleSpinner(false); // Removed: Call to toggleSpinner
        isLoading = false; // Reset isLoading directly
        console.log(`[displayImage] fallbackImage: isLoading set to false: ${isLoading}`);

        updateThumbnails(); // Update thumbnails even on error
        console.log("[displayImage] Fallback image displayed.");
    }

    // Set up onload/onerror handlers for the main image
    mainImage.onload = function () {
        console.log("[displayImage] mainImage.onload fired.");
        if (loadHandled) {
            console.log("[displayImage] onload: Event already handled, returning.");
            return;
        }
        clearTimeout(timeout);
        loadHandled = true;

        console.log(`[displayImage] onload: Image loaded. Natural dimensions: ${this.naturalWidth}x${this.naturalHeight}`);

        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            console.log("[displayImage] onload: Image dimensions too small (placeholder).");
            fallbackImage(`No more images available or image is invalid for Stock #${currentStockNumber}`);
        } else {
            console.log("[displayImage] onload: Image valid. Updating UI.");
            mainImage.style.opacity = 1; // Restore full opacity
            mainImage.classList.remove("no-image-available");
            zoomedImage.classList.remove("no-image-available");
            $("#instructions").hide();
            // toggleSpinner(false); // Removed: Call to toggleSpinner
            isLoading = false; // Reset isLoading directly
            console.log(`[displayImage] onload: isLoading set to false: ${isLoading}`);

            updateThumbnails(); // Update thumbnails after main image loads
            console.log("[displayImage] onload: UI updated, thumbnails updated.");
        }
    };

    mainImage.onerror = function () {
        console.log("[displayImage] mainImage.onerror fired.");
        if (loadHandled) {
            console.log("[displayImage] onerror: Event already handled, returning.");
            return;
        }
        clearTimeout(timeout);
        loadHandled = true;
        fallbackImage("Failed to load image (onerror event).");
        console.log("[displayImage] onerror: Fallback image displayed.");
    };

    // Set the source last to trigger loading
    mainImage.src = imageUrl;
    zoomedImage.src = imageUrl; // Also set for the zoom modal
    mainImage.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    zoomedImage.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    $("#kmxlink").attr("href", `https://www.carmax.com/car/${currentStockNumber}`);
    console.log(`[displayImage] Main image source set to: ${imageUrl}`);
}

// Update thumbnail images and set active state
function updateThumbnails() {
    console.log("[updateThumbnails] Called.");
    // Calculate start index to try and center the current image
    let startIndex = Math.max(1, currentImageIndex - Math.floor(MAX_THUMBNAILS / 2));
    // Ensure we don't go past the MAX_IMAGE_INDEX with the last thumbnail
    startIndex = Math.min(startIndex, MAX_IMAGE_INDEX - MAX_THUMBNAILS + 1);
    // Ensure startIndex is never less than 1
    startIndex = Math.max(1, startIndex);
    console.log(`[updateThumbnails] Calculated startIndex: ${startIndex}`);

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const imageIndex = startIndex + i;
        const thumb = $(`#thumb${i + 1}`);

        if (thumb.length === 0) {
            console.warn(`[updateThumbnails] Thumbnail element #thumb${i + 1} not found.`);
            continue;
        }

        const url = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${imageIndex}.jpg?width=100&height=75`;
        const noStock = !currentStockNumber;
        console.log(`[updateThumbnails] Processing thumb${i + 1} for imageIndex: ${imageIndex}, URL: ${url}`);

        thumb.attr("src", noStock ? PLACEHOLDER_THUMBNAIL : url);
        thumb.attr("alt", `Thumbnail ${imageIndex}`);
        thumb.data("image-index", imageIndex); // Store the actual image index

        // Add/remove active class based on currentImageIndex
        if (currentStockNumber && imageIndex === currentImageIndex) {
            thumb.addClass("active-thumbnail");
            console.log(`[updateThumbnails] thumb${i + 1} marked as active.`);
        } else {
            thumb.removeClass("active-thumbnail");
        }

        // Handle thumbnail load/error
        thumb[0].onload = function () {
            console.log(`[updateThumbnails] Thumbnail ${this.id} onload fired. Natural dimensions: ${this.naturalWidth}x${this.naturalHeight}`);
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add("no-image-available");
                // Remove clickability if placeholder
                $(this).off("click").css("cursor", "not-allowed");
                console.log(`[updateThumbnails] Thumbnail ${this.id} identified as placeholder, set to N/A.`);
            } else {
                this.classList.remove("no-image-available");
                // Re-add clickability
                $(this).off("click").on("click", handleThumbnailClick).css("cursor", "pointer");
                console.log(`[updateThumbnails] Thumbnail ${this.id} is valid.`);
            }
        };

        thumb[0].onerror = function () {
            console.error(`[updateThumbnails] Thumbnail ${this.id} onerror fired.`);
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add("no-image-available");
            $(this).off("click").css("cursor", "not-allowed"); // Remove clickability on error
            console.log(`[updateThumbnails] Thumbnail ${this.id} failed to load, set to N/A.`);
        };

        // If no stock number, default to placeholder and no-image-available
        if (noStock) {
            thumb.addClass("no-image-available");
            $(thumb).off("click").css("cursor", "not-allowed");
            console.log(`[updateThumbnails] No stock number, thumbnail ${i + 1} set to no-image-available.`);
        } else {
            // Ensure click handler is set if a stock number exists
            $(thumb).off("click").on("click", handleThumbnailClick).css("cursor", "pointer");
        }
    }
}

// Handler for thumbnail clicks
function handleThumbnailClick() {
    const clickedIndex = $(this).data("image-index");
    console.log(`[handleThumbnailClick] Thumbnail with index ${clickedIndex} clicked.`);
    if (clickedIndex && currentStockNumber) {
        displayImage(clickedIndex);
    }
}

// Previous image
function prvs() {
    console.log("[prvs] Previous button clicked.");
    if (currentStockNumber && currentImageIndex > 1) {
        displayImage(currentImageIndex - 1);
    } else {
        console.log("[prvs] No more previous images or no stock number.");
    }
}

// Next image
function nxt() {
    console.log("[nxt] Next button clicked.");
    if (currentStockNumber) {
        if (currentImageIndex < MAX_IMAGE_INDEX) {
            displayImage(currentImageIndex + 1);
        } else {
            $("#instructions").show().html(`<p><strong>No more images. Max is ${MAX_IMAGE_INDEX}.</strong></p>`);
            console.log("[nxt] Reached max image index.");
        }
    } else {
        $("#instructions").show().html("<strong>Enter Stock #:</strong> Please enter a stock number to view images.");
        console.log("[nxt] No stock number entered.");
    }
}

// Submit by Stock Number
document.getElementById("btn_submit").onclick = function () {
    console.log("[btn_submit] Search (VIN) button clicked.");
    const val = document.getElementById("VINbar").value.trim();
    console.log(`[btn_submit] VINbar value: "${val}"`);
    if (/^\d{8}$/.test(val)) {
        currentStockNumber = val;
        currentImageIndex = 1; // Start from the first image for a new stock number
        console.log(`[btn_submit] Valid Stock Number. Setting currentStockNumber to ${currentStockNumber}. Calling displayImage.`);
        displayImage(currentImageIndex);
    } else {
        $("#instructions").show().html("<strong>Invalid Stock Number:</strong> Must be 8 digits.");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Stock Number");
        $("#zoomedImage").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Stock Number");
        currentStockNumber = ""; // Clear stock number on invalid input
        updateThumbnails(); // Clear thumbnails
        $("#kmxlink").attr("href", "#");
        console.log("[btn_submit] Invalid Stock Number. Resetting UI.");
    }
};

// Submit by CarMax URL
document.getElementById("btn_submit2").onclick = function () {
    console.log("[btn_submit2] Search (Link) button clicked.");
    const val = document.getElementById("LINKbar").value.trim();
    console.log(`[btn_submit2] LINKbar value: "${val}"`);
    const match = val.match(/(?:vehicles|img)\/(\d{8})(?:\/(\d+))?/i);
    if (match && match[1]) {
        currentStockNumber = match[1];
        currentImageIndex = Math.min(parseInt(match[2]) || 1, MAX_IMAGE_INDEX);
        document.getElementById("VINbar").value = currentStockNumber; // Populate VIN bar
        console.log(`[btn_submit2] Valid Link. Stock Number: ${currentStockNumber}, Image Index: ${currentImageIndex}. Calling displayImage.`);
        displayImage(currentImageIndex);
    } else {
        $("#instructions").show().html("<strong>Invalid URL. Paste a valid CarMax image link.</strong>");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Link");
        $("#zoomedImage").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Link");
        currentStockNumber = ""; // Clear stock number on invalid input
        updateThumbnails(); // Clear thumbnails
        $("#kmxlink").attr("href", "#");
        console.log("[btn_submit2] Invalid Link. Resetting UI.");
    }
};

// Handle Enter key for both fields
["VINbar", "LINKbar"].forEach((id) => {
    document.getElementById(id).addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            console.log(`[Keyboard Event] Enter key pressed on ${id}. Triggering click event.`);
            document.getElementById(id === "VINbar" ? "btn_submit" : "btn_submit2").click();
        }
    });
});

// Initialize on document ready
$(document).ready(function () {
    console.log("[Document Ready] Initializing application.");
    const mainImage = document.getElementById("dispframe");
    const zoomedImage = document.getElementById("zoomedImage");
    mainImage.src = INITIAL_PLACEHOLDER_IMAGE;
    zoomedImage.src = INITIAL_PLACEHOLDER_IMAGE;
    mainImage.alt = "Enter Stock Number";
    zoomedImage.alt = "Enter Stock Number";
    $("#instructions").show().html("<p><strong>Enter Stock #</strong></p>");
    currentStockNumber = ""; // Ensure stock number is cleared on initial load
    updateThumbnails(); // Load initial placeholder thumbnails
    console.log("[Document Ready] Initial UI set up.");
});

// Zoom modal functionality
$("#dispframe").on("click", function () {
    console.log("[Zoom Modal] Main image clicked.");
    if (currentStockNumber && !$(this).hasClass("no-image-available") && $(this).attr("src") !== PLACEHOLDER_MAIN_IMAGE) {
        const zoomedImage = document.getElementById("zoomedImage");
        zoomedImage.src = this.src;
        zoomedImage.alt = this.alt;
        $(zoomedImage).removeClass("no-image-available"); // Ensure it's not dimmed
        // Ensure modal instance is created if it doesn't exist
        $("#imageZoomModal").data("bs.modal") || new bootstrap.Modal(document.getElementById("imageZoomModal"));
        $("#imageZoomModal").modal("show");
        console.log("[Zoom Modal] Showing zoom modal.");
    } else {
        console.log("[Zoom Modal] Click ignored: No stock number, image unavailable, or placeholder.");
    }
});
