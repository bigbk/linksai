var currentUVIndex = 1; // Current index for UV image
var currentRegularIndex = 10; // Current index for Regular image (starting from 10)
var currentStockNumber = "";
let isLoading = false; // Flag to prevent multiple image loads simultaneously

const MAX_UV_IMAGES = 40; // Max UV images to try (UV1 to UV40)
const MAX_REGULAR_IMAGES = 50; // Max Regular images to try (10.jpg to 50.jpg, adjust as needed)
const MAX_THUMBNAILS_DISPLAY = 8; // Number of thumbnails to show per row/section

const CARMAX_BASE_IMAGE_URL = "https://img2.carmax.com/assets/";
const PLACEHOLDER_MAIN_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Image+Not+Available";
const PLACEHOLDER_THUMBNAIL = "https://placehold.co/100x75/eeeeee/aaaaaa?text=N/A";
const INITIAL_PLACEHOLDER_IMAGE = "https://placehold.co/800x600/cccccc/000000?text=Enter+Stock+%23";
const MIN_IMAGE_SIZE_BYTES = 50 * 1024; // 50KB minimum size for a valid image

// --- Centralized Image Loader with Promise, Timeout, and Size Check ---
async function loadImage(imageUrl, isMainImage = false) {
    console.log(`[loadImage] Attempting to load: ${imageUrl}`);
    return new Promise((resolve, reject) => {
        const img = new Image();
        let timeoutId;
        let loadHandled = false;

        const cleanup = () => {
            clearTimeout(timeoutId);
            img.onload = null;
            img.onerror = null;
        };

        timeoutId = setTimeout(() => {
            if (!loadHandled) {
                loadHandled = true;
                cleanup();
                console.warn(`[loadImage] Timeout for ${imageUrl}`);
                reject(new Error("Image load timed out."));
            }
        }, 7000); // 7-second timeout

        img.onload = function () {
            if (loadHandled) return;
            loadHandled = true;
            cleanup();

            console.log(`[loadImage] Loaded: ${imageUrl} (Dimensions: ${this.naturalWidth}x${this.naturalHeight})`);

            if (this.naturalWidth <= 11 && this.naturalHeight <= 11) {
                console.log(`[loadImage] Image is too small/invalid placeholder: ${imageUrl}`);
                reject(new Error("Image is too small or an invalid placeholder."));
            } else if (isMainImage) {
                // For main images, we also need to check size if possible, though fetch is better for that
                // Here we just use dimension check for simplicity, actual size check done by fetch.
                resolve(imageUrl); // Resolve with the URL if it's a valid image
            } else {
                // For thumbnails, we resolve directly after dimension check
                resolve(imageUrl);
            }
        };

        img.onerror = function () {
            if (loadHandled) return;
            loadHandled = true;
            cleanup();
            console.error(`[loadImage] Failed to load (onerror): ${imageUrl}`);
            reject(new Error("Image failed to load."));
        };

        img.src = imageUrl;
    });
}


// --- Main function to display images and update thumbnails ---
async function displayImage(imageType, requestedIndex) {
    console.log(`[displayImage] Called for type: ${imageType}, requestedIndex: ${requestedIndex}`);

    if (isLoading) {
        console.log("[displayImage] Aborting: An image load is already in progress.");
        return;
    }
    isLoading = true; // Set isLoading true at the start of display cycle

    let mainImageElement;
    let currentImageVar;
    let maxImages;
    let baseUrl;
    let prefix = ''; // For 'UV'

    if (imageType === 'uv') {
        mainImageElement = document.getElementById("dispframeUV");
        currentUVIndex = Math.max(1, Math.min(requestedIndex, MAX_UV_IMAGES)); // Cap index
        currentImageVar = currentUVIndex;
        maxImages = MAX_UV_IMAGES;
        prefix = 'UV';
    } else if (imageType === 'regular') {
        mainImageElement = document.getElementById("dispframeRegular");
        currentRegularIndex = Math.max(10, Math.min(requestedIndex, MAX_REGULAR_IMAGES)); // Regular starts from 10
        currentImageVar = currentRegularIndex;
        maxImages = MAX_REGULAR_IMAGES;
    } else {
        console.error(`[displayImage] Invalid imageType: ${imageType}`);
        isLoading = false;
        return;
    }

    const imageUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/image/${prefix}${currentImageVar}.jpg`;
    const zoomedImageElement = document.getElementById("zoomImage");

    // Dim the main image and show placeholder immediately
    mainImageElement.style.opacity = 0.5;
    mainImageElement.src = PLACEHOLDER_MAIN_IMAGE; // Set placeholder
    zoomedImageElement.src = PLACEHOLDER_MAIN_IMAGE;
    mainImageElement.classList.add("no-image-available"); // Add class temporarily
    zoomedImageElement.classList.add("no-image-available");

    $("#instructions").text("Loading image..."); // Update instruction message

    try {
        // Fetch to check size first, then load image
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        if (blob.size < MIN_IMAGE_SIZE_BYTES) {
            throw new Error("Image too small.");
        }

        // If fetch successful and size ok, set actual image sources
        mainImageElement.src = imageUrl;
        zoomedImageElement.src = imageUrl;
        mainImageElement.style.opacity = 1; // Restore full opacity
        mainImageElement.classList.remove("no-image-available");
        zoomedImageElement.classList.remove("no-image-available");
        $("#instructions").hide(); // Hide instruction message

        console.log(`[displayImage] Successfully loaded and displayed: ${imageUrl}`);

    } catch (error) {
        console.error(`[displayImage] Error loading ${imageType} image ${imageUrl}:`, error);
        mainImageElement.src = PLACEHOLDER_MAIN_IMAGE;
        zoomedImageElement.src = PLACEHOLDER_MAIN_IMAGE;
        mainImageElement.classList.add("no-image-available");
        zoomedImageElement.classList.add("no-image-available");
        $("#instructions").show().html(`<strong>Image not found or invalid:</strong> ${imageType.toUpperCase()} ${currentImageVar}.`);

        // If current image failed, try next, but don't loop endlessly
        if (currentImageVar < maxImages) {
            console.log(`[displayImage] Trying next ${imageType} image...`);
            if (imageType === 'uv') {
                currentUVIndex++;
            } else {
                currentRegularIndex++;
            }
            isLoading = false; // Allow recursive call
            return displayImage(imageType, (imageType === 'uv' ? currentUVIndex : currentRegularIndex)); // Recursively call for next image
        } else {
            $("#instructions").show().html(`<strong>No more ${imageType.toUpperCase()} images available for Stock #${currentStockNumber}.</strong>`);
            console.log(`[displayImage] Reached maximum ${imageType} image limit.`);
        }
    } finally {
        isLoading = false; // Ensure isLoading is reset
        updateThumbnails(imageType); // Always update thumbnails after a display attempt
    }
}


// --- Update Thumbnail Sections ---
function updateThumbnails(imageTypeToUpdate = null) {
    console.log(`[updateThumbnails] Called for type: ${imageTypeToUpdate || 'all'}`);

    const updateSection = (containerId, currentIdx, maxIdx, typePrefix, minStartingIndex = 1) => {
        const gallery = document.getElementById(containerId);
        gallery.innerHTML = ""; // Clear previous thumbnails

        // Calculate start index to try and center the current image
        let startIndex = Math.max(minStartingIndex, currentIdx - Math.floor(MAX_THUMBNAILS_DISPLAY / 2));
        startIndex = Math.min(startIndex, maxIdx - MAX_THUMBNAILS_DISPLAY + 1);
        startIndex = Math.max(minStartingIndex, startIndex); // Ensure never less than min

        for (let i = 0; i < MAX_THUMBNAILS_DISPLAY; i++) {
            const imgIndex = startIndex + i;
            const thumbnailUrl = `${CARMAX_BASE_IMAGE_URL}${currentStockNumber}/image/${typePrefix}${imgIndex}.jpg?width=100&height=75`;

            const thumbnailWrapper = document.createElement("div");
            thumbnailWrapper.className = "col-3 col-sm-3 col-md-3 col-thumbnails mb-2"; // Bootstrap 4 per row
            thumbnailWrapper.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img class="img-fluid rounded thumbnail-img" src="${PLACEHOLDER_THUMBNAIL}"
                         data-image-type="${typePrefix === 'UV' ? 'uv' : 'regular'}"
                         data-image-index="${imgIndex}"
                         alt="Thumbnail ${typePrefix} ${imgIndex}">
                </div>
            `;
            gallery.appendChild(thumbnailWrapper);

            const thumbImgElement = thumbnailWrapper.querySelector('.thumbnail-img');

            // Load thumbnail image using the loadImage helper
            loadImage(thumbnailUrl)
                .then(() => {
                    thumbImgElement.src = thumbnailUrl;
                    thumbImgElement.classList.remove("no-image-available");
                    // Add click handler for valid thumbnails
                    thumbImgElement.addEventListener('click', handleThumbnailClick);
                    thumbImgElement.style.cursor = 'pointer';
                })
                .catch(() => {
                    thumbImgElement.src = PLACEHOLDER_THUMBNAIL;
                    thumbImgElement.classList.add("no-image-available");
                    // Remove click handler for invalid/placeholder thumbnails
                    thumbImgElement.removeEventListener('click', handleThumbnailClick);
                    thumbImgElement.style.cursor = 'not-allowed';
                });

            // Set active class if this is the current displayed image
            if (currentStockNumber && imgIndex === currentIdx) {
                thumbImgElement.classList.add("active-thumbnail");
            } else {
                thumbImgElement.classList.remove("active-thumbnail");
            }

            // If no stock number, default to placeholder and no-image-available
            if (!currentStockNumber) {
                thumbImgElement.src = PLACEHOLDER_THUMBNAIL;
                thumbImgElement.classList.add("no-image-available");
                thumbImgElement.removeEventListener('click', handleThumbnailClick);
                thumbImgElement.style.cursor = 'not-allowed';
            }
        }
    };

    if (imageTypeToUpdate === 'uv' || !imageTypeToUpdate) {
        updateSection("uvThumbnails", currentUVIndex, MAX_UV_IMAGES, 'UV', 1);
    }
    if (imageTypeToUpdate === 'regular' || !imageTypeToUpdate) {
        updateSection("regularThumbnails", currentRegularIndex, MAX_REGULAR_IMAGES, '', 10); // Regular images have no prefix
    }
}

// --- Thumbnail Click Handler ---
function handleThumbnailClick(event) {
    const clickedElement = event.target;
    const imageType = clickedElement.dataset.imageType;
    const imageIndex = parseInt(clickedElement.dataset.imageIndex, 10);
    console.log(`[handleThumbnailClick] Clicked: Type=${imageType}, Index=${imageIndex}`);

    if (currentStockNumber && !isNaN(imageIndex)) {
        displayImage(imageType, imageIndex);
    }
}

// --- Navigation Functions ---
function prvs(imageType) {
    console.log(`[prvs] Previous button clicked for ${imageType}.`);
    if (!currentStockNumber) {
        $("#instructions").show().html("<strong>Enter Stock #:</strong> Please enter a stock number to view images.");
        return;
    }

    if (imageType === 'uv') {
        if (currentUVIndex > 1) {
            displayImage('uv', currentUVIndex - 1);
        } else {
            $("#instructions").show().html(`<strong>No more UV images. Currently at UV1.</strong>`);
        }
    } else if (imageType === 'regular') {
        if (currentRegularIndex > 10) { // Regular images start from 10
            displayImage('regular', currentRegularIndex - 1);
        } else {
            $("#instructions").show().html(`<strong>No more Regular images. Currently at 10.jpg.</strong>`);
        }
    }
}

function nxt(imageType) {
    console.log(`[nxt] Next button clicked for ${imageType}.`);
    if (!currentStockNumber) {
        $("#instructions").show().html("<strong>Enter Stock #:</strong> Please enter a stock number to view images.");
        return;
    }

    if (imageType === 'uv') {
        if (currentUVIndex < MAX_UV_IMAGES) {
            displayImage('uv', currentUVIndex + 1);
        } else {
            $("#instructions").show().html(`<strong>No more UV images. Max is UV${MAX_UV_IMAGES}.</strong>`);
        }
    } else if (imageType === 'regular') {
        if (currentRegularIndex < MAX_REGULAR_IMAGES) {
            displayImage('regular', currentRegularIndex + 1);
        } else {
            $("#instructions").show().html(`<strong>No more Regular images. Max is ${MAX_REGULAR_IMAGES}.jpg.</strong>`);
        }
    }
}


// --- Zoom Modal Functions ---
function openZoom(imageType) {
    let mainImageSrc;
    let mainImageAlt;

    if (imageType === 'uv') {
        mainImageSrc = document.getElementById("dispframeUV").src;
        mainImageAlt = document.getElementById("dispframeUV").alt;
    } else if (imageType === 'regular') {
        mainImageSrc = document.getElementById("dispframeRegular").src;
        mainImageAlt = document.getElementById("dispframeRegular").alt;
    }

    if (currentStockNumber && mainImageSrc && !mainImageSrc.includes("placehold.co")) {
        const zoomedImage = document.getElementById("zoomImage");
        zoomedImage.src = mainImageSrc;
        zoomedImage.alt = mainImageAlt;
        $(zoomedImage).removeClass("no-image-available zoomed"); // Reset zoom state & remove unavailable class
        $('#zoomModal').modal('show');
        console.log(`[Zoom Modal] Showing zoom modal for ${imageType} image.`);
    } else {
        console.log(`[Zoom Modal] Click ignored: No stock number or placeholder image for ${imageType}.`);
    }
}

function toggleZoom() {
    var zoomImg = document.getElementById("zoomImage");
    zoomImg.classList.toggle("zoomed"); // Toggle zoomed class for CSS scaling
    console.log("[Zoom Modal] Zoom toggled.");
}


// --- Initial Setup and Event Listeners ---
document.getElementById("btn_submit").onclick = async function () {
    const val = document.getElementById("VINbar").value.trim();
    console.log(`[btn_submit] Search (VIN) button clicked. VINbar value: "${val}"`);

    if (/^\d{8}$/.test(val)) {
        currentStockNumber = val;
        currentUVIndex = 1; // Always start UV from 1 for new stock #
        currentRegularIndex = 10; // Always start Regular from 10 for new stock #
        $("#instructions").hide();

        // Display both image types
        await displayImage('uv', currentUVIndex); // Wait for UV to load first
        await displayImage('regular', currentRegularIndex); // Then load regular
    } else {
        $("#instructions").show().html("<strong>Invalid Stock Number:</strong> Must be 8 digits.");
        document.getElementById("dispframeUV").src = INITIAL_PLACEHOLDER_IMAGE;
        document.getElementById("dispframeRegular").src = INITIAL_PLACEHOLDER_IMAGE;
        document.getElementById("dispframeUV").classList.add("no-image-available");
        document.getElementById("dispframeRegular").classList.add("no-image-available");
        document.getElementById("zoomImage").src = INITIAL_PLACEHOLDER_IMAGE; // Update zoom modal too
        currentStockNumber = ""; // Clear stock number on invalid input
        updateThumbnails('uv'); // Clear UV thumbnails
        updateThumbnails('regular'); // Clear Regular thumbnails
        console.log("[btn_submit] Invalid Stock Number. Resetting UI.");
    }
};

// Handle Enter key for VIN bar
document.getElementById("VINbar").addEventListener("keyup", function (event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent default form submission
        document.getElementById("btn_submit").click();
        console.log("[Keyboard Event] Enter key pressed on VINbar. Triggering search.");
    }
});


// Initialize on document ready
$(document).ready(function () {
    console.log("[Document Ready] Initializing application for UV/Regular images.");
    const mainUVImage = document.getElementById("dispframeUV");
    const mainRegularImage = document.getElementById("dispframeRegular");
    const zoomImage = document.getElementById("zoomImage");

    mainUVImage.src = INITIAL_PLACEHOLDER_IMAGE;
    mainRegularImage.src = INITIAL_PLACEHOLDER_IMAGE;
    zoomImage.src = INITIAL_PLACEHOLDER_IMAGE;

    mainUVImage.alt = "Enter Stock Number";
    mainRegularImage.alt = "Enter Stock Number";
    zoomImage.alt = "Enter Stock Number";

    mainUVImage.classList.add("no-image-available"); // Start with unavailable class
    mainRegularImage.classList.add("no-image-available");
    zoomImage.classList.add("no-image-available");

    $("#instructions").show().html("<p><strong>Enter Stock # to view images.</strong></p>");
    currentStockNumber = ""; // Ensure stock number is cleared on initial load

    // Initialize with empty/placeholder thumbnails
    updateThumbnails('uv');
    updateThumbnails('regular');
    console.log("[Document Ready] Initial UI set up with placeholders.");
});
