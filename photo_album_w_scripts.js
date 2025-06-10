var currentImageIndex = 1,
    currentStockNumber = "";
    const MAX_IMAGE_INDEX = 40;


const MAX_THUMBNAILS = 8,
    CARMAX_BASE_IMAGE_URL = "https://img2.carmax.com/img/vehicles/",
    PLACEHOLDER_MAIN_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available",
    PLACEHOLDER_THUMBNAIL = "https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A",
    INITIAL_PLACEHOLDER_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23";

// Show or hide the loading spinner modal
function toggleSpinner(show) {
    if (show) {
        $("#spinnerModal").data("bs.modal") || new bootstrap.Modal(document.getElementById("spinnerModal"));
        $("#spinnerModal").modal("show");
    } else {
        setTimeout(() => {
            $("#spinnerModal").modal("hide");
        }, 100);
    }
}

// Display the main image and zoomed image, handle loading states and errors
function displayImage(requestedIndex) {
    const mainImage = document.getElementById("dispframe"),
        zoomedImage = document.getElementById("zoomedImage");

    if (!currentStockNumber) {
        $("#instructions").show().html("<p><strong>Enter Stock #</strong></p>");
        mainImage.src = INITIAL_PLACEHOLDER_IMAGE;
        mainImage.alt = "Enter Stock Number";
        $(mainImage).removeClass("no-image-available");
        zoomedImage.src = INITIAL_PLACEHOLDER_IMAGE;
        $(zoomedImage).removeClass("no-image-available");
        updateThumbnails();
        $("#kmxlink").attr("href", "#");
        return;
    }

    // Ensure index is at least 1
    currentImageIndex = Math.max(1, Math.min(requestedIndex, MAX_IMAGE_INDEX));


    mainImage.style.opacity = 0;
    toggleSpinner(true);
    $("#instructions").show().html("<p>Loading image...</p>");

    const cacheBuster = Date.now();
    const imageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${currentImageIndex}.jpg?cb=${cacheBuster}`;

    mainImage.onerror = null;
    mainImage.onload = null;
    mainImage.src = imageUrl;
    mainImage.alt = `Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;

    zoomedImage.src = imageUrl;
    zoomedImage.alt = `Zoomed Vehicle Image ${currentImageIndex} for Stock #${currentStockNumber}`;

    // Set a timeout to handle slow or missing images
    const loadTimeout = setTimeout(() => {
        console.warn("Image load timed out.");
        mainImage.src = PLACEHOLDER_MAIN_IMAGE;
        mainImage.classList.add("no-image-available");
        zoomedImage.src = PLACEHOLDER_MAIN_IMAGE;
        zoomedImage.classList.add("no-image-available");
        $("#instructions").show().html("<p><strong>Image took too long to load or is missing.</strong></p>");
        toggleSpinner(false);
    }, 7000);

    mainImage.onload = function () {
        clearTimeout(loadTimeout);
        mainImage.style.opacity = 1;
        toggleSpinner(false);
        $("#instructions").hide();

        // Detect fallback image (very small image usually)
        if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
            // If user tried to go forward but no image, revert index back
            if (requestedIndex > currentImageIndex) {
                currentImageIndex = Math.max(1, currentImageIndex - 1);
            }
            this.src = PLACEHOLDER_MAIN_IMAGE;
            this.classList.add("no-image-available");
            zoomedImage.src = PLACEHOLDER_MAIN_IMAGE;
            zoomedImage.classList.add("no-image-available");
            $("#instructions").show().html(`<p><strong>No more images available for Stock #${currentStockNumber}</strong></p>`);
            return;
        }

        this.classList.remove("no-image-available");
        zoomedImage.classList.remove("no-image-available");
        updateThumbnails();
    };

    mainImage.onerror = function () {
        clearTimeout(loadTimeout);
        mainImage.style.opacity = 1;
        this.src = "https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error";
        this.classList.add("no-image-available");
        zoomedImage.src = "https://placehold.co/800x600/cccccc/000000?text=Image+Load+Error";
        zoomedImage.classList.add("no-image-available");
        toggleSpinner(false);
        $("#instructions").show().html("<p><strong>Failed to load image.</strong></p>");
    };

    $("#kmxlink").attr("href", `https://www.carmax.com/car/${currentStockNumber}`);
}

// Update the thumbnail images below the main image
function updateThumbnails() {
    let startIndex = Math.max(1, currentImageIndex - 3);

    for (let i = 0; i < MAX_THUMBNAILS; i++) {
        const imageIndex = Math.min(MAX_IMAGE_INDEX, startIndex + i);
        const thumb = $(`#thumb${i + 1}`);


        if (thumb.length === 0) continue;

        const url = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/${imageIndex}.jpg?width=100&height=75&cb=${Date.now()}`;
        const noStock = !currentStockNumber;

        thumb[0].onerror = null;
        thumb[0].onload = null;

        thumb.attr("src", noStock ? PLACEHOLDER_THUMBNAIL : url);
        thumb.attr("alt", `Thumbnail ${imageIndex}`);
        thumb.data("image-index", imageIndex);

        if (currentStockNumber && imageIndex === currentImageIndex) {
            thumb.addClass("active-thumbnail");
        } else {
            thumb.removeClass("active-thumbnail");
        }

        thumb[0].onload = function () {
            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                this.src = PLACEHOLDER_THUMBNAIL;
                this.classList.add("no-image-available");
            } else {
                this.classList.remove("no-image-available");
            }
        };

        thumb[0].onerror = function () {
            this.src = PLACEHOLDER_THUMBNAIL;
            this.classList.add("no-image-available");
        };

        if (noStock) {
            thumb.addClass("no-image-available");
        } else {
            thumb.removeClass("no-image-available");
        }
    }
}

// Go to previous image if possible
function prvs() {
    if (currentStockNumber && currentImageIndex > 1) {
        displayImage(currentImageIndex - 1);
    }
}

// Go to next image, displayImage will handle missing images gracefully
function nxt() {
    if (currentStockNumber && currentImageIndex < MAX_IMAGE_INDEX) {
        displayImage(currentImageIndex + 1);
    } else {
        $("#instructions").show().html(`<p><strong>No more images. Max is ${MAX_IMAGE_INDEX}.</strong></p>`);
    }
}


// Submit button for entering stock number manually
document.getElementById("btn_submit").onclick = function () {
    const val = document.getElementById("VINbar").value.trim();
    if (/^\d{8}$/.test(val)) {
        currentStockNumber = val;
        displayImage(currentImageIndex = 1);
    } else {
        $("#instructions").show().html("<strong>Invalid Stock Number:</strong> Must be 8 digits.");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Stock Number");
        currentStockNumber = "";
        updateThumbnails();
        $("#kmxlink").attr("href", "#");
    }
};

// Submit button for entering URL containing stock number and optional image index
document.getElementById("btn_submit2").onclick = function () {
    const val = document.getElementById("LINKbar").value.trim();
    const match = val.match(/(?:vehicles|img)\/(\d{8})(?:\/(\d+))?/i);
    if (match && match[1]) {
        currentStockNumber = match[1];
        currentImageIndex = parseInt(match[2]) || 1;
        document.getElementById("VINbar").value = currentStockNumber;
        displayImage(currentImageIndex);
    } else {
        $("#instructions").show().html("<strong>Invalid URL. Paste a valid CarMax image link.</strong>");
        $("#dispframe").attr("src", INITIAL_PLACEHOLDER_IMAGE).attr("alt", "Invalid Link");
        currentStockNumber = "";
        updateThumbnails();
        $("#kmxlink").attr("href", "#");
    }
};

// Allow pressing Enter key to trigger submit buttons
["VINbar", "LINKbar"].forEach((id) => {
    document.getElementById(id).addEventListener("keyup", function (event) {
        if (event.key === "Enter") {
            if (id === "VINbar") {
                document.getElementById("btn_submit").click();
            } else {
                document.getElementById("btn_submit2").click();
            }
        }
    });
});

// Initialize page by displaying placeholder image
$(document).ready(function () {
    displayImage(currentImageIndex);
});

// Clicking the main image opens zoom modal if image is available
$("#dispframe").on("click", function () {
    if (!$(this).hasClass("no-image-available") && currentStockNumber) {
        const zoomedImage = document.getElementById("zoomedImage");
        zoomedImage.src = this.src;
        zoomedImage.alt = this.alt;
        $(zoomedImage).removeClass("no-image-available");
        $("#imageZoomModal").data("bs.modal") || new bootstrap.Modal(document.getElementById("imageZoomModal"));
        $("#imageZoomModal").modal("show");
    }
});
