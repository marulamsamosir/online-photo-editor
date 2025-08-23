class PhotoEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.originalImage = null;
        this.currentImage = null;
        this.settings = this.getDefaultSettings();
        this.cropMode = false;
        this.cropData = { x: 0, y: 0, width: 0, height: 0 };
        this.currentAspectRatio = 'free';
        this.toneCurvePoints = [[0, 0], [255, 255]]; // Linear curve initially
        this.fileInfo = {};
        
        this.initializeEditor();
        this.setupEventListeners();
        this.drawToneCurve();
    }

    getDefaultSettings() {
        return {
            exposure: 0,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            whites: 0,
            blacks: 0,
            temperature: 0,
            tint: 0,
            vibrance: 0,
            saturation: 0,
            texture: 0,
            clarity: 0,
            dehaze: 0,
            vignetteAmount: 0,
            vignetteMidpoint: 50,
            vignetteFeather: 50,
            vignetteRoundness: 0,
            vignetteHighlights: 0,
            grainAmount: 0,
            grainSize: 25,
            grainRoughness: 50,
            sharpenAmount: 25,
            sharpenRadius: 1,
            sharpenDetail: 25,
            sharpenMasking: 0,
            noiseLuminance: 0,
            noiseDetail: 50,
            noiseContrast: 0,
            noiseColor: 25,
            colorNoiseDetail: 50,
            colorNoiseSmoothness: 50,
            straighten: 0,
            gradingBlending: 50,
            gradingBalance: 0,
            colorMix: {
                red: { hue: 0, saturation: 0, luminance: 0 },
                orange: { hue: 0, saturation: 0, luminance: 0 },
                yellow: { hue: 0, saturation: 0, luminance: 0 },
                green: { hue: 0, saturation: 0, luminance: 0 },
                aqua: { hue: 0, saturation: 0, luminance: 0 },
                blue: { hue: 0, saturation: 0, luminance: 0 },
                purple: { hue: 0, saturation: 0, luminance: 0 },
                magenta: { hue: 0, saturation: 0, luminance: 0 }
            },
            colorGrading: {
                shadows: { hue: 0, saturation: 0, luminance: 0 },
                midtones: { hue: 0, saturation: 0, luminance: 0 },
                highlights: { hue: 0, saturation: 0, luminance: 0 },
                global: { hue: 0, saturation: 0, luminance: 0 }
            }
        };
    }

    initializeEditor() {
        // Update all slider value displays
        this.updateAllValueDisplays();
    }

    setupEventListeners() {
        // File input
        $('#fileInput').on('change', (e) => this.handleFileLoad(e));

        // Preset buttons
        $('.preset-btn').on('click', (e) => this.applyPreset($(e.target).data('preset')));

        // Tab switching
        $('.tab').on('click', (e) => this.switchTab($(e.target).data('tab')));

        // All sliders
        $('.slider').on('input', (e) => this.handleSliderChange(e));

        // Double click reset for sliders
        $('.slider').on('dblclick', (e) => this.resetSlider(e));

        // Slider reset buttons
        $('.slider-reset').on('click', (e) => {
            const slider = $(e.target).siblings('.slider');
            this.resetSlider({ target: slider[0] });
        });

        // Reset button
        $('#resetBtn').on('click', () => this.resetAll());

        // Save button
        $('#saveBtn').on('click', () => this.saveImage());

        // Aspect ratio buttons
        $('.aspect-btn').on('click', (e) => this.setAspectRatio($(e.target).data('aspect')));

        // Apply crop button
        $('#applyCropBtn').on('click', () => this.applyCrop());

        // Crop overlay events
        $('#cropOverlay').on('mousedown', (e) => this.startCropDrag(e));
        $(document).on('mousemove', (e) => this.updateCropDrag(e));
        $(document).on('mouseup', () => this.endCropDrag());

        // Tone curve canvas
        $('#toneCurve').on('mousedown', (e) => this.startToneCurveEdit(e));
        $(document).on('mousemove', (e) => this.updateToneCurve(e));
        $(document).on('mouseup', () => this.endToneCurveEdit());
    }

    resetSlider(event) {
        const slider = $(event.target);
        const id = slider.attr('id');
        
        // Get default value based on slider
        let defaultValue = 0;
        if (id.includes('midpoint') || id.includes('feather')) {
            defaultValue = 50;
        } else if (id === 'grain-size' || id === 'grain-roughness') {
            defaultValue = 25;
        } else if (id === 'sharpen-amount' || id === 'sharpen-detail') {
            defaultValue = 25;
        } else if (id === 'sharpen-radius') {
            defaultValue = 1;
        } else if (id === 'noise-detail' || id === 'color-noise-detail' || 
                  id === 'color-noise-smoothness' || id === 'grading-blending') {
            defaultValue = 50;
        } else if (id === 'noise-color') {
            defaultValue = 25;
        }

        slider.val(defaultValue);
        this.handleSliderChange(event);
    }

    extractExifData(file) {
        return new Promise((resolve) => {
            EXIF.getData(file, function() {
                const exifData = {
                    camera: EXIF.getTag(this, "Make") + " " + (EXIF.getTag(this, "Model") || ""),
                    lens: EXIF.getTag(this, "LensModel") || "-",
                    iso: EXIF.getTag(this, "ISOSpeedRatings") || "-",
                    aperture: EXIF.getTag(this, "FNumber") ? "f/" + EXIF.getTag(this, "FNumber") : "-",
                    shutter: EXIF.getTag(this, "ExposureTime") || "-",
                    focalLength: EXIF.getTag(this, "FocalLength") ? EXIF.getTag(this, "FocalLength") + "mm" : "-",
                    dateTaken: EXIF.getTag(this, "DateTime") || "-",
                    gpsLat: EXIF.getTag(this, "GPSLatitude"),
                    gpsLon: EXIF.getTag(this, "GPSLongitude"),
                    gpsLatRef: EXIF.getTag(this, "GPSLatitudeRef"),
                    gpsLonRef: EXIF.getTag(this, "GPSLongitudeRef")
                };
                
                // Format GPS coordinates
                if (exifData.gpsLat && exifData.gpsLon) {
                    const lat = this.convertDMSToDD(exifData.gpsLat, exifData.gpsLatRef);
                    const lon = this.convertDMSToDD(exifData.gpsLon, exifData.gpsLonRef);
                    exifData.location = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                } else {
                    exifData.location = "-";
                }

                resolve(exifData);
            });
        });
    }

    convertDMSToDD(dms, ref) {
        let dd = dms[0] + dms[1]/60 + dms[2]/3600;
        if (ref === "S" || ref === "W") dd = dd * -1;
        return dd;
    }

    updateImageInfo(file, img, exifData) {
        const fileSize = (file.size / 1024 / 1024).toFixed(2) + " MB";
        
        $('#fileSize').text(fileSize);
        $('#dimensions').text(`${img.width} × ${img.height} pixels`);
        $('#camera').text(exifData.camera.trim() || "-");
        $('#lens').text(exifData.lens);
        $('#iso').text(exifData.iso);
        $('#aperture').text(exifData.aperture);
        $('#shutter').text(exifData.shutter);
        $('#focalLength').text(exifData.focalLength);
        $('#dateTaken').text(exifData.dateTaken);
        $('#location').text(exifData.location);
        
        $('#image-info-section').show();
    }

    async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Extract EXIF data
        const exifData = await this.extractExifData(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.currentImage = img;
                this.fileInfo = { file, exifData };
                this.displayImage();
                this.updateHistogram();
                this.updateImageInfo(file, img, exifData);
                $('#imageInfo').text(`${img.width} × ${img.height} pixels`);
                $('.status-bar').text('Image loaded successfully');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayImage() {
        if (!this.currentImage) return;

        const containerWidth = $('.canvas-container').width() - 40;
        const containerHeight = $('.canvas-container').height() - 40;

        // Calculate display size maintaining aspect ratio
        const imgAspect = this.currentImage.width / this.currentImage.height;
        const containerAspect = containerWidth / containerHeight;

        let displayWidth, displayHeight;
        if (imgAspect > containerAspect) {
            displayWidth = Math.min(containerWidth, this.currentImage.width);
            displayHeight = displayWidth / imgAspect;
        } else {
            displayHeight = Math.min(containerHeight, this.currentImage.height);
            displayWidth = displayHeight * imgAspect;
        }

        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;

        // Clear with solid background for rotation
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, displayWidth, displayHeight);

        this.applyAllEffects();
    }

    applyAllEffects() {
        if (!this.originalImage) return;

        // Create a temporary canvas for processing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        // Apply rotation if needed
        if (this.settings.straighten !== 0) {
            tempCtx.save();
            tempCtx.fillStyle = '#1a1a1a';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
            tempCtx.rotate((this.settings.straighten * Math.PI) / 180);
            tempCtx.drawImage(this.originalImage, -tempCanvas.width / 2, -tempCanvas.height / 2, tempCanvas.width, tempCanvas.height);
            tempCtx.restore();
        } else {
            tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);
        }

        // Get image data
        let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        let data = imageData.data;

        // Apply effects in order
        this.applyExposureAndContrast(data);
        this.applyColorAdjustments(data);
        this.applyColorMix(data);
        this.applyColorGrading(data);
        this.applyToneCurve(data);
        this.applyEffects(data, tempCanvas.width, tempCanvas.height);

        // Put processed data back
        tempCtx.putImageData(imageData, 0, 0);

        // Clear canvas with background color then draw processed image
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempCanvas, 0, 0);

        this.updateHistogram();
    }

    applyColorMix(data) {
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Convert to HSL
            let hsl = this.rgbToHsl(r, g, b);
            let hue = hsl[0] * 360;

            // Determine dominant color
            let colorRange = this.getColorRange(hue);
            if (colorRange && this.settings.colorMix[colorRange]) {
                const mix = this.settings.colorMix[colorRange];
                
                // Apply color mix adjustments
                hsl[0] = (hsl[0] + mix.hue / 360) % 1;
                hsl[1] = Math.max(0, Math.min(1, hsl[1] * (1 + mix.saturation / 100)));
                hsl[2] = Math.max(0, Math.min(1, hsl[2] * (1 + mix.luminance / 100)));
            }

            // Convert back to RGB
            const rgb = this.hslToRgb(hsl[0], hsl[1], hsl[2]);
            data[i] = Math.max(0, Math.min(255, rgb[0] * 255));
            data[i + 1] = Math.max(0, Math.min(255, rgb[1] * 255));
            data[i + 2] = Math.max(0, Math.min(255, rgb[2] * 255));
        }
    }

    getColorRange(hue) {
        if (hue >= 0 && hue < 30 || hue >= 330) return 'red';
        if (hue >= 30 && hue < 60) return 'orange';
        if (hue >= 60 && hue < 90) return 'yellow';
        if (hue >= 90 && hue < 150) return 'green';
        if (hue >= 150 && hue < 210) return 'aqua';
        if (hue >= 210 && hue < 270) return 'blue';
        if (hue >= 270 && hue < 300) return 'purple';
        if (hue >= 300 && hue < 330) return 'magenta';
        return null;
    }

    applyColorGrading(data, width, height) {
        const blending = this.settings.gradingBlending / 100;
        const balance = this.settings.gradingBalance / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Determine tone range
            let grading;
            if (luminance < 0.33) {
                grading = this.settings.colorGrading.shadows;
            } else if (luminance < 0.67) {
                grading = this.settings.colorGrading.midtones;
            } else {
                grading = this.settings.colorGrading.highlights;
            }

            // Apply global grading
            const globalGrading = this.settings.colorGrading.global;
            
            // Convert to HSL
            let hsl = this.rgbToHsl(r, g, b);
            
            // Apply grading adjustments
            hsl[0] = (hsl[0] + (grading.hue + globalGrading.hue) / 360) % 1;
            hsl[1] = Math.max(0, Math.min(1, hsl[1] * (1 + (grading.saturation + globalGrading.saturation) / 100)));
            hsl[2] = Math.max(0, Math.min(1, hsl[2] * (1 + (grading.luminance + globalGrading.luminance) / 100)));
            
            // Apply blending and balance
            hsl[1] *= blending;
            hsl[0] = (hsl[0] + balance / 360) % 1;

            // Convert back to RGB
            const rgb = this.hslToRgb(hsl[0], hsl[1], hsl[2]);
            data[i] = Math.max(0, Math.min(255, rgb[0] * 255));
            data[i + 1] = Math.max(0, Math.min(255, rgb[1] * 255));
            data[i + 2] = Math.max(0, Math.min(255, rgb[2] * 255));
        }
    }

    applyExposureAndContrast(data) {
        const exposure = Math.pow(2, this.settings.exposure);
        const contrast = (this.settings.contrast + 100) / 100;
        const highlights = this.settings.highlights / 100;
        const shadows = this.settings.shadows / 100;
        const whites = this.settings.whites / 100;
        const blacks = this.settings.blacks / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Apply exposure
            r *= exposure;
            g *= exposure;
            b *= exposure;

            // Apply contrast
            r = ((r - 0.5) * contrast) + 0.5;
            g = ((g - 0.5) * contrast) + 0.5;
            b = ((b - 0.5) * contrast) + 0.5;

            // Apply highlights and shadows
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            if (luminance > 0.5) {
                const factor = 1 + highlights * (1 - luminance);
                r *= factor;
                g *= factor;
                b *= factor;
            } else {
                const factor = 1 + shadows * luminance;
                r *= factor;
                g *= factor;
                b *= factor;
            }

            // Apply whites and blacks
            r = r + whites * (1 - r) + blacks * r;
            g = g + whites * (1 - g) + blacks * g;
            b = b + whites * (1 - b) + blacks * b;

            // Clamp values
            data[i] = Math.max(0, Math.min(255, r * 255));
            data[i + 1] = Math.max(0, Math.min(255, g * 255));
            data[i + 2] = Math.max(0, Math.min(255, b * 255));
        }
    }

    applyColorAdjustments(data) {
        const temp = this.settings.temperature / 100;
        const tint = this.settings.tint / 100;
        const vibrance = this.settings.vibrance / 100;
        const saturation = this.settings.saturation / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Apply temperature (blue-yellow)
            if (temp > 0) {
                r = Math.min(1, r + temp * 0.3);
                g = Math.min(1, g + temp * 0.1);
                b = Math.max(0, b - temp * 0.2);
            } else {
                r = Math.max(0, r + temp * 0.2);
                g = Math.max(0, g + temp * 0.1);
                b = Math.min(1, b - temp * 0.3);
            }

            // Apply tint (green-magenta)
            if (tint > 0) {
                g = Math.min(1, g + tint * 0.2);
            } else {
                r = Math.min(1, r - tint * 0.1);
                b = Math.min(1, b - tint * 0.1);
            }

            // Convert to HSL for saturation and vibrance
            const hsl = this.rgbToHsl(r, g, b);

            // Apply vibrance (affects less saturated colors more)
            if (vibrance !== 0) {
                const vibranceEffect = vibrance * (1 - hsl[1]);
                hsl[1] = Math.max(0, Math.min(1, hsl[1] + vibranceEffect));
            }

            // Apply saturation
            if (saturation !== 0) {
                hsl[1] = Math.max(0, Math.min(1, hsl[1] * (1 + saturation)));
            }

            // Convert back to RGB
            const rgb = this.hslToRgb(hsl[0], hsl[1], hsl[2]);
            data[i] = Math.max(0, Math.min(255, rgb[0] * 255));
            data[i + 1] = Math.max(0, Math.min(255, rgb[1] * 255));
            data[i + 2] = Math.max(0, Math.min(255, rgb[2] * 255));
        }
    }

    applyToneCurve(data) {
        // Create lookup table from curve points
        const lut = new Array(256);
        for (let i = 0; i < 256; i++) {
            lut[i] = this.interpolateToneCurve(i);
        }

        for (let i = 0; i < data.length; i += 4) {
            data[i] = lut[data[i]];
            data[i + 1] = lut[data[i + 1]];
            data[i + 2] = lut[data[i + 2]];
        }
    }

    applyEffects(data, width, height) {
        const texture = this.settings.texture / 100;
        const clarity = this.settings.clarity / 100;
        const dehaze = this.settings.dehaze / 100;
        const vignetteAmount = this.settings.vignetteAmount / 100;
        const vignetteMidpoint = this.settings.vignetteMidpoint / 100;
        const vignetteFeather = this.settings.vignetteFeather / 100;
        const vignetteRoundness = this.settings.vignetteRoundness / 100;
        const vignetteHighlights = this.settings.vignetteHighlights / 100;
        const grainAmount = this.settings.grainAmount / 100;
        const grainSize = this.settings.grainSize / 100;
        const grainRoughness = this.settings.grainRoughness / 100;

        const centerX = width / 2;
        const centerY = height / 2;
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);

            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Apply clarity (local contrast)
            if (clarity !== 0) {
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const contrast = clarity * 0.5;
                r = r + (r - luminance) * contrast;
                g = g + (g - luminance) * contrast;
                b = b + (b - luminance) * contrast;
            }

            // Apply texture
            if (texture !== 0) {
                const textureNoise = (Math.random() - 0.5) * texture * 0.1;
                r += textureNoise;
                g += textureNoise;
                b += textureNoise;
            }

            // Apply dehaze
            if (dehaze !== 0) {
                const factor = 1 + dehaze * 0.3;
                r = ((r - 0.5) * factor) + 0.5;
                g = ((g - 0.5) * factor) + 0.5;
                b = ((b - 0.5) * factor) + 0.5;
            }

            // Apply vignette with improved algorithm
            if (vignetteAmount !== 0) {
                const dx = (x - centerX) / centerX;
                const dy = (y - centerY) / centerY;
                
                // Apply roundness
                const ellipticalDistance = Math.sqrt(dx * dx * (1 + vignetteRoundness) + dy * dy * (1 - vignetteRoundness));
                
                // Calculate vignette strength
                const vignetteRadius = vignetteMidpoint;
                const falloff = Math.max(0, (ellipticalDistance - vignetteRadius) / (1 - vignetteRadius));
                const smoothFalloff = Math.pow(falloff, 1 / vignetteFeather);
                
                let vignetteStrength = 1 - vignetteAmount * smoothFalloff;
                
                // Apply highlight protection
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                if (vignetteHighlights > 0 && luminance > 0.8) {
                    vignetteStrength = 1 - vignetteAmount * smoothFalloff * (1 - vignetteHighlights * (luminance - 0.8) / 0.2);
                }
                
                r *= vignetteStrength;
                g *= vignetteStrength;
                b *= vignetteStrength;
            }

            // Apply grain with improved algorithm
            if (grainAmount > 0) {
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const grainIntensity = grainAmount * (1 - Math.abs(luminance - 0.5) * 0.5);
                
                // Generate grain based on position for consistency
                const grainSeed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
                const grain = (grainSeed - Math.floor(grainSeed) - 0.5) * grainIntensity * grainSize;
                const roughnessVar = Math.sin(x * grainRoughness + y * grainRoughness) * grainIntensity * 0.1;
                
                const finalGrain = grain + roughnessVar;
                r += finalGrain;
                g += finalGrain;
                b += finalGrain;
            }

            // Clamp values
            data[i] = Math.max(0, Math.min(255, r * 255));
            data[i + 1] = Math.max(0, Math.min(255, g * 255));
            data[i + 2] = Math.max(0, Math.min(255, b * 255));
        }
    }

    handleSliderChange(event) {
        const slider = $(event.target);
        const id = slider.attr('id');
        const value = parseFloat(slider.val());

        // Update value display
        const valueDisplay = $(`#${id}-value`);
        if (valueDisplay.length) {
            if (id === 'straighten') {
                valueDisplay.text(value + '°');
            } else {
                valueDisplay.text(value);
            }
        }

        // Update settings
        this.updateSetting(id, value);

        // Apply changes
        if (this.originalImage) {
            this.displayImage();
        }
    }

    updateSetting(id, value) {
        const settingMap = {
            'exposure': 'exposure',
            'contrast': 'contrast',
            'highlights': 'highlights',
            'shadows': 'shadows',
            'whites': 'whites',
            'blacks': 'blacks',
            'temperature': 'temperature',
            'tint': 'tint',
            'vibrance': 'vibrance',
            'saturation': 'saturation',
            'texture': 'texture',
            'clarity': 'clarity',
            'dehaze': 'dehaze',
            'vignette-amount': 'vignetteAmount',
            'vignette-midpoint': 'vignetteMidpoint',
            'vignette-feather': 'vignetteFeather',
            'vignette-roundness': 'vignetteRoundness',
            'vignette-highlights': 'vignetteHighlights',
            'grain-amount': 'grainAmount',
            'grain-size': 'grainSize',
            'grain-roughness': 'grainRoughness',
            'sharpen-amount': 'sharpenAmount',
            'sharpen-radius': 'sharpenRadius',
            'sharpen-detail': 'sharpenDetail',
            'sharpen-masking': 'sharpenMasking',
            'noise-luminance': 'noiseLuminance',
            'noise-detail': 'noiseDetail',
            'noise-contrast': 'noiseContrast',
            'noise-color': 'noiseColor',
            'color-noise-detail': 'colorNoiseDetail',
            'color-noise-smoothness': 'colorNoiseSmoothness',
            'straighten': 'straighten',
            'grading-blending': 'gradingBlending',
            'grading-balance': 'gradingBalance'
        };

        if (settingMap[id]) {
            this.settings[settingMap[id]] = value;
        }

        // Handle color mix sliders
        const slider = $(`#${id}`);
        if (slider.data('color') && slider.data('type')) {
            const color = slider.data('color');
            const type = slider.data('type');
            this.settings.colorMix[color][type] = value;
        }

        // Handle color grading sliders
        if (slider.data('grading') && slider.data('type')) {
            const grading = slider.data('grading');
            const type = slider.data('type');
            this.settings.colorGrading[grading][type] = value;
        }
    }

    setAspectRatio(aspect) {
        $('.aspect-btn').removeClass('active');
        $(`.aspect-btn[data-aspect="${aspect}"]`).addClass('active');
        this.currentAspectRatio = aspect;
        
        if (aspect !== 'free' && this.originalImage) {
            this.initializeCrop();
        }
    }

    initializeCrop() {
        if (!this.originalImage) return;
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const containerRect = $('.canvas-container')[0].getBoundingClientRect();
        
        let cropWidth, cropHeight;
        const aspectRatios = {
            '1:1': 1,
            '4:3': 4/3,
            '16:9': 16/9,
            '3:2': 3/2,
            '5:4': 5/4
        };
        
        const targetRatio = aspectRatios[this.currentAspectRatio];
        const canvasRatio = this.canvas.width / this.canvas.height;
        
        if (targetRatio > canvasRatio) {
            // Crop is wider than canvas
            cropWidth = this.canvas.width * 0.8;
            cropHeight = cropWidth / targetRatio;
        } else {
            // Crop is taller than canvas
            cropHeight = this.canvas.height * 0.8;
            cropWidth = cropHeight * targetRatio;
        }
        
        this.cropData = {
            x: (this.canvas.width - cropWidth) / 2,
            y: (this.canvas.height - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight
        };
        
        this.showCropOverlay();
    }

    showCropOverlay() {
        const canvasRect = this.canvas.getBoundingClientRect();
        const containerRect = $('.canvas-container')[0].getBoundingClientRect();
        
        const scaleX = canvasRect.width / this.canvas.width;
        const scaleY = canvasRect.height / this.canvas.height;
        
        const overlay = $('#cropOverlay');
        overlay.css({
            left: canvasRect.left - containerRect.left + this.cropData.x * scaleX,
            top: canvasRect.top - containerRect.top + this.cropData.y * scaleY,
            width: this.cropData.width * scaleX,
            height: this.cropData.height * scaleY,
            display: 'block'
        });
    }

    applyCrop() {
        if (!this.originalImage || !this.cropData) return;
        
        // Create new canvas with cropped image
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        
        // Calculate crop coordinates relative to original image
        const scaleX = this.originalImage.width / this.canvas.width;
        const scaleY = this.originalImage.height / this.canvas.height;
        
        const cropX = this.cropData.x * scaleX;
        const cropY = this.cropData.y * scaleY;
        const cropWidth = this.cropData.width * scaleX;
        const cropHeight = this.cropData.height * scaleY;
        
        cropCanvas.width = cropWidth;
        cropCanvas.height = cropHeight;
        
        cropCtx.drawImage(this.originalImage, 
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight);
        
        // Update original image
        const newImg = new Image();
        newImg.onload = () => {
            this.originalImage = newImg;
            this.currentImage = newImg;
            $('#cropOverlay').hide();
            this.displayImage();
        };
        newImg.src = cropCanvas.toDataURL();
    }

    applyPreset(preset) {
        this.resetAll();

        const presets = {
            'original': {},
            'bw': {
                saturation: -100
            },
            'warm': {
                temperature: 30,
                tint: 10,
                highlights: -20,
                shadows: 20
            },
            'cold': {
                temperature: -30,
                tint: -10,
                highlights: 10,
                shadows: -10
            },
            'cinematic': {
                contrast: 25,
                highlights: -30,
                shadows: 30,
                vignetteAmount: -20,
                clarity: 15
            },
            'vintage': {
                exposure: 0.2,
                contrast: -15,
                highlights: -40,
                shadows: 15,
                temperature: 15,
                saturation: -20,
                vignetteAmount: -30,
                grainAmount: 25
            },
            'dramatic': {
                contrast: 40,
                clarity: 30,
                dehaze: 20,
                blacks: -20,
                whites: 15
            },
            'soft': {
                contrast: -20,
                highlights: -20,
                shadows: 20,
                clarity: -15
            }
        };

        const presetSettings = presets[preset] || {};
        Object.keys(presetSettings).forEach(key => {
            this.settings[key] = presetSettings[key];
        });

        this.updateAllSliders();
        if (this.originalImage) {
            this.displayImage();
        }
    }

    updateAllSliders() {
        Object.keys(this.settings).forEach(key => {
            if (key === 'colorMix' || key === 'colorGrading') return;
            
            const slider = this.getSliderBySettingKey(key);
            if (slider) {
                slider.val(this.settings[key]);
                const valueDisplay = $(`#${slider.attr('id')}-value`);
                if (valueDisplay.length) {
                    if (slider.attr('id') === 'straighten') {
                        valueDisplay.text(this.settings[key] + '°');
                    } else {
                        valueDisplay.text(this.settings[key]);
                    }
                }
            }
        });
    }

    updateAllValueDisplays() {
        $('.slider').each((i, slider) => {
            const $slider = $(slider);
            const id = $slider.attr('id');
            const value = $slider.val();
            const valueDisplay = $(`#${id}-value`);
            if (valueDisplay.length) {
                if (id === 'straighten') {
                    valueDisplay.text(value + '°');
                } else {
                    valueDisplay.text(value);
                }
            }
        });
    }

    getSliderBySettingKey(settingKey) {
        const keyMap = {
            'exposure': '#exposure',
            'contrast': '#contrast',
            'highlights': '#highlights',
            'shadows': '#shadows',
            'whites': '#whites',
            'blacks': '#blacks',
            'temperature': '#temperature',
            'tint': '#tint',
            'vibrance': '#vibrance',
            'saturation': '#saturation',
            'texture': '#texture',
            'clarity': '#clarity',
            'dehaze': '#dehaze',
            'vignetteAmount': '#vignette-amount',
            'vignetteMidpoint': '#vignette-midpoint',
            'vignetteFeather': '#vignette-feather',
            'vignetteRoundness': '#vignette-roundness',
            'vignetteHighlights': '#vignette-highlights',
            'grainAmount': '#grain-amount',
            'grainSize': '#grain-size',
            'grainRoughness': '#grain-roughness',
            'sharpenAmount': '#sharpen-amount',
            'sharpenRadius': '#sharpen-radius',
            'sharpenDetail': '#sharpen-detail',
            'sharpenMasking': '#sharpen-masking',
            'noiseLuminance': '#noise-luminance',
            'noiseDetail': '#noise-detail',
            'noiseContrast': '#noise-contrast',
            'noiseColor': '#noise-color',
            'colorNoiseDetail': '#color-noise-detail',
            'colorNoiseSmoothness': '#color-noise-smoothness',
            'straighten': '#straighten',
            'gradingBlending': '#grading-blending',
            'gradingBalance': '#grading-balance'
        };

        return keyMap[settingKey] ? $(keyMap[settingKey]) : null;
    }

    switchTab(tabName) {
        // Main tabs
        if (['crop', 'edit'].includes(tabName)) {
            $('.tab[data-tab="crop"], .tab[data-tab="edit"]').removeClass('active');
            $(`.tab[data-tab="${tabName}"]`).addClass('active');
            $('#crop-tab, #edit-tab').removeClass('active');
            $(`#${tabName}-tab`).addClass('active');
        }

        // Edit sub-tabs
        if (['light', 'color', 'effect', 'detail'].includes(tabName)) {
            $('#edit-tab .tab').removeClass('active');
            $(`.tab[data-tab="${tabName}"]`).addClass('active');
            $('#edit-tab .tab-content').removeClass('active');
            $(`#${tabName}-content`).addClass('active');
        }
    }

    resetAll() {
        this.settings = this.getDefaultSettings();
        this.toneCurvePoints = [[0, 0], [255, 255]];
        this.updateAllSliders();
        this.drawToneCurve();
        $('#cropOverlay').hide();
        if (this.originalImage) {
            this.displayImage();
        }
    }

    saveImage() {
        if (!this.canvas) return;

        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }

    updateHistogram() {
        if (!this.canvas) return;

        const histogramCanvas = document.getElementById('histogram');
        const histCtx = histogramCanvas.getContext('2d');
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Initialize histograms
        const red = new Array(256).fill(0);
        const green = new Array(256).fill(0);
        const blue = new Array(256).fill(0);

        // Count pixel values
        for (let i = 0; i < data.length; i += 4) {
            red[data[i]]++;
            green[data[i + 1]]++;
            blue[data[i + 2]]++;
        }

        // Find max for normalization
        const maxR = Math.max(...red);
        const maxG = Math.max(...green);
        const maxB = Math.max(...blue);
        const max = Math.max(maxR, maxG, maxB);

        // Clear histogram canvas
        histCtx.clearRect(0, 0, 260, 100);

        // Draw histograms
        const drawHistogram = (values, color, alpha) => {
            histCtx.globalAlpha = alpha;
            histCtx.fillStyle = color;
            for (let i = 0; i < 256; i++) {
                const height = (values[i] / max) * 100;
                histCtx.fillRect(i, 100 - height, 1, height);
            }
        };

        drawHistogram(red, '#ff4444', 0.7);
        drawHistogram(green, '#44ff44', 0.7);
        drawHistogram(blue, '#4444ff', 0.7);

        histCtx.globalAlpha = 1;
    }

    // Color space conversion utilities
    rgbToHsl(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h, s, l];
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [r, g, b];
    }

    // Tone curve methods
    drawToneCurve() {
        const canvas = document.getElementById('toneCurve');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, 260, 150);
        
        // Draw grid
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const x = (i / 4) * 260;
            const y = (i / 4) * 150;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 150);
            ctx.moveTo(0, y);
            ctx.lineTo(260, y);
            ctx.stroke();
        }

        // Draw diagonal reference line
        ctx.strokeStyle = '#666';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, 150);
        ctx.lineTo(260, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw curve
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < 256; x++) {
            const y = 150 - (this.interpolateToneCurve(x) / 255) * 150;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Draw control points
        ctx.fillStyle = '#007acc';
        this.toneCurvePoints.forEach(point => {
            const x = point[0];
            const y = 150 - (point[1] / 255) * 150;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    interpolateToneCurve(x) {
        if (this.toneCurvePoints.length < 2) return x;

        // Find the two points to interpolate between
        let i = 0;
        while (i < this.toneCurvePoints.length - 1 && this.toneCurvePoints[i + 1][0] < x) {
            i++;
        }

        if (i === this.toneCurvePoints.length - 1) {
            return this.toneCurvePoints[i][1];
        }

        const p1 = this.toneCurvePoints[i];
        const p2 = this.toneCurvePoints[i + 1];

        const t = (x - p1[0]) / (p2[0] - p1[0]);
        return p1[1] + t * (p2[1] - p1[1]);
    }

    startToneCurveEdit(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to curve coordinates
        const curveX = Math.max(0, Math.min(255, x));
        const curveY = Math.max(0, Math.min(255, 255 - (y / 150) * 255));

        // Find or create point
        this.toneCurveEditMode = true;
        this.toneCurvePoints.push([curveX, curveY]);
        this.toneCurvePoints.sort((a, b) => a[0] - b[0]);
        
        this.drawToneCurve();
    }

    updateToneCurve(e) {
        if (!this.toneCurveEditMode) return;

        const canvas = document.getElementById('toneCurve');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x >= 0 && x <= 260 && y >= 0 && y <= 150) {
            const curveX = Math.max(0, Math.min(255, x));
            const curveY = Math.max(0, Math.min(255, 255 - (y / 150) * 255));

            // Update the last point
            if (this.toneCurvePoints.length > 0) {
                this.toneCurvePoints[this.toneCurvePoints.length - 1] = [curveX, curveY];
                this.toneCurvePoints.sort((a, b) => a[0] - b[0]);
                this.drawToneCurve();
                if (this.originalImage) {
                    this.displayImage();
                }
            }
        }
    }

    endToneCurveEdit() {
        this.toneCurveEditMode = false;
    }

    // Crop drag methods
    startCropDrag(e) {
        if (!this.cropData || $('#cropOverlay').css('display') === 'none') return;
        
        this.cropDragging = true;
        this.cropDragStart = { x: e.clientX, y: e.clientY };
        e.preventDefault();
    }

    updateCropDrag(e) {
        if (!this.cropDragging) return;

        const dx = e.clientX - this.cropDragStart.x;
        const dy = e.clientY - this.cropDragStart.y;

        const canvasRect = this.canvas.getBoundingClientRect();
        const containerRect = $('.canvas-container')[0].getBoundingClientRect();
        const scaleX = this.canvas.width / canvasRect.width;
        const scaleY = this.canvas.height / canvasRect.height;

        this.cropData.x = Math.max(0, Math.min(this.canvas.width - this.cropData.width, 
            this.cropData.x + dx * scaleX));
        this.cropData.y = Math.max(0, Math.min(this.canvas.height - this.cropData.height, 
            this.cropData.y + dy * scaleY));

        this.showCropOverlay();
        this.cropDragStart = { x: e.clientX, y: e.clientY };
    }

    endCropDrag() {
        this.cropDragging = false;
    }
}