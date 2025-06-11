var currentImageIndex = 1;
var currentStockNumber = "";
let isLoading = false; // Flag to prevent multiple image loads simultaneously

const MAX_IMAGE_INDEX = 40;
const MAX_THUMBNAILS = 8; // Number of thumbnail slots in the HTML
const CARMAX_BASE_IMAGE_URL = "https://img2.carmax.com/img/vehicles/";
const PLACEHOLDER_MAIN_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available";
const PLACEHOLDER_THUMBNAIL = "https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A";
const INITIAL_PLACEHOLDER_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23";

// Show or hide the loading spinner modal
function toggleSpinner(show) {
    if (show) {
        // Ensure the modal instance exists before showing
        if (!$("#spinnerModal").data("bs.modal")) {
            new bootstrap.Modal(document.getElementById("spinnerModal"));
        }
        $("#spinnerModal").modal("show");
    } else {
        // Use a slight delay to ensure the spinner is visible before hiding
        setTimeout(() => {
            $("#spinnerModal").modal("hide");
        }, 100);
    }
}

// Display the main image and zoomed image, handle loading states and errors
function displayImage(requestedIndex) {
    if (isLoading) return; // Prevent multiple loads if one is in progress
    isLoading = true;

    const mainImage = document.getElementById("dispframe");
    const zoomedImage = document.getElementById("zoomedImage");

    // Show spinner immediately and reset image sources/alts
    mainImage.style.opacity = 0.5; // Dim current image while loading new
    toggleSpinner(true);

    currentImageIndex = Math.max(1, Math.min(requestedIndex, MAX_IMAGE_INDEX));
    const imageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg`;

    let loadHandled = false; // To prevent double handling of load/error events

    const timeout = setTimeout(() => {
        if (!loadHandled) { // Only fallback if load/error hasn't already fired
            fallbackImage("Image took too long to load or is missing.");
            loadHandled = true; // Mark as handled
        }
    }, 7000);

    function fallbackImage(message) {
        mainImage.src = PLACEHOLDER_MAIN_IMAGE;
        zoomedImage.src = PLACEHOLDER_MAIN_IMAGE;
        mainImage.classList.add("no-image-available");
        zoomedImage.classList.add("no-image-available");
        $("#instructions").show().html(`<p><strong>${message}</strong></p>`);
        toggleSpinner(false);
        isLoading = false; // Reset isLoading on error
        updateThumbnails(); // Update thumbnails even on error
    }

    // Set up onload/onerror handlers for the main image
    mainImage.onload = function () {
        if (loadHandled) return;
        clearTimeout(timeout);
        loadHandled = true;
        isLoading = false; // Reset isLoading on successful load

        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            fallbackImage(`No more images available for Stock #${currentStockNumber}`);
        } else {
            mainImage.style.opacity = 1; // Restore full opacity
            mainImage.classList.remove("no-image-available");
            zoomedImage.classList.remove("no-image-available");
            $("#instructions").hide();
            toggleSpinner(false);
            updateThumbnails(); // Update thumbnails after main image loads
        }
    };

    mainImage.onerror = function () {
        if (loadHandled) return;
        clearTimeout(timeout);
        loadHandled = true;
        fallbackImage("Failed to load image.");
    };

    // Set the source last to trigger loading
    mainImage.src = imageUrl;
    zoomedImage.src = imageUrl; // Also set for the zoom modal
    mainImage.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    zoomedImage.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;
    $("#kmxlink").attr("href", `https://www.carmax.com/car/${currentStockNumber}`);
}

// Update thumbnail images and set active state
function updateThumbnails() {
    // Calculate start index to try and center the current image
    let startIndex = Math.max(1, currentImageIndex - Math.floor(MAX_THUMBNAILS / 2));
    // Ensure we don't go past the MAX_IMAGE_INDEX with the last thumbnail
    startIndex = Math.min(startIndex, MAX_IMAGE_INDEX - MAX_THUMBNAILS + 1);
    // Ensure startIndex is never less than 1
    startIndex = Math.max(1, startIndex);

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const imageIndex = startIndex + i;
        const thumb = $(`#thumb${i + 1}`);

        if (thumb.length === 0) continue; // Skip if thumbnail element doesn't exist

        const url = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${imageIndex}.jpg?width=100&height=75`; // Removed cb=${Date.now()}
        const noStock = !currentStockNumber;

        thumb.attr("src", noStock ? PLACEHOLDER_THUMBNAIL : url);
        thumb.attr("alt", `Thumbnail ${imageIndex}`);
        thumb.data("image-index", imageIndex); // Store the actual image index

        // Add/remove active class based on currentImageIndex
        if (currentStockNumber && imageIndex === currentImageIndex) {
            thumb.addClass("active-thumbnail");
        } else {
            thumb.removeClass("active-thumbnail");
        }

        // Handle thumbnail load/error
        thumb[0].onload = function () {
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add("no-image-available");
                // Remove clickability if placeholder
                $(this).off("click").css("cursor", "not-allowed");
            } else {
                this.classList.remove("no-image-available");
                // Re-add clickability
                $(this).off("click").on("click", handleThumbnailClick).css("cursor", "pointer");
            }
        };

        thumb[0].onerror = function () {
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add("no-image-available");
            $(this).off("click").css("cursor", "not-allowed"); // Remove clickability on error
        };

        // If no stock number, default to placeholder and no-image-available
        if (noStock) {
            thumb.addClass("no-image-available");
            $(thumb).off("click").css("cursor", "not-allowed");
        } else {
            // Ensure click handler is set if a stock number exists
            $(thumb).off("click").on("click", handleThumbnailClick).css("cursor", "pointer");
        }
    }
}

// Handler for thumbnail clicks
function handleThumbnailClick() {
    const clickedIndex = $(this).data("image-index");
    if (clickedIndex && currentStockNumber) {
        displayImage(clickedIndex);
    }
}

// Previous image
function prvs() {
    if (currentStockNumber && currentImageIndex > 1) {
        displayImage(currentImageIndex - 1);
    }
}

// Next image
function nxt() {
    if (currentStockNumber) {
        if (currentImageIndex < MAX_IMAGE_INDEX) {
            displayImage(currentImageIndex + 1);
        } else {
            $("#instructions").show().html(`<p><strong>No more images. Max is ${MAX_IMAGE_INDEX}.</strong></p>`);
        }
    } else {
        $("#instructions").show().html("<strong>Enter Stock #:</strong> Please enter a stock number to view images.");
    }
}

// Submit by Stock Number
document.getElementById("btn_submit").onclick = function () {
    const val = document.getElementById("VINbar").value.trim();
    if (/^\d{8}$/.test(val)) {
        currentStockNumber = val;
        currentImageIndex = 1; // Start from the first image for a new stock number
        displayImage(currentImageIndex);
    } else {
        $("#instructions").show().html("<strong>Invalid Stock Number:</strong> Must be 8 digits.");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Stock Number");
        $("#zoomedImage").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Stock Number");
        currentStockNumber = ""; // Clear stock number on invalid input
        updateThumbnails(); // Clear thumbnails
        $("#kmxlink").attr("href", "#");
    }
};

// Submit by CarMax URL
document.getElementById("btn_submit2").onclick = function () {
    const val = document.getElementById("LINKbar").value.trim();
    const match = val.match(/(?:vehicles|img)\/(\d{8})(?:\/(\d+))?/i); // Adjusted regex to be more robust
    if (match && match[1]) {
        currentStockNumber = match[1];
        // If an image index is found in the URL, use it, otherwise default to 1
        currentImageIndex = Math.min(parseInt(match[2]) || 1, MAX_IMAGE_INDEX);
        document.getElementById("VINbar").value = currentStockNumber; // Populate VIN bar
        displayImage(currentImageIndex);
    } else {
        $("#instructions").show().html("<strong>Invalid URL. Paste a valid CarMax image link.</strong>");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Link");
        $("#zoomedImage").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Link");
        currentStockNumber = ""; // Clear stock number on invalid input
        updateThumbnails(); // Clear thumbnails
        $("#kmxlink").attr("href", "#");
    }
};

// Handle Enter key for both fields
["VINbar", "LINKbar"].forEach((id) => {
    document.getElementById(id).addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            document.getElementById(id === "VINbar" ? "btn_submit" : "btn_submit2").click();
        }
    });
});

// Initialize on document ready
$(document).ready(function () {
    // Initial state: show placeholder and clear thumbnails
    const mainImage = document.getElementById("dispframe");
    const zoomedImage = document.getElementById("zoomedImage");
    mainImage.src = INITIAL_PLACEHOLDER_IMAGE;
    zoomedImage.src = INITIAL_PLACEHOLDER_IMAGE;
    mainImage.alt = "Enter Stock Number";
    zoomedImage.alt = "Enter Stock Number";
    $("#instructions").show().html("<p><strong>Enter Stock #</strong></p>");
    currentStockNumber = ""; // Ensure stock number is cleared on initial load
    updateThumbnails(); // Load initial placeholder thumbnails
});

// Zoom modal functionality
$("#dispframe").on("click", function () {
    // Only allow zoom if there's a current stock number and the image isn't a placeholder
    if (currentStockNumber && !$(this).hasClass("no-image-available") && $(this).attr("src") !== PLACEHOLDER_MAIN_IMAGE) {
        const zoomedImage = document.getElementById("zoomedImage");
        zoomedImage.src = this.src;
        zoomedImage.alt = this.alt;
        $(zoomedImage).removeClass("no-image-available"); // Ensure it's not dimmed
        $("#imageZoomModal").data("bs.modal") || new bootstrap.Modal(document.getElementById("imageZoomModal")); // Ensure modal instance
        $("#imageZoomModal").modal("show");
    }
});
