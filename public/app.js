(() => {
    const video = document.querySelector('.hero-video');

    const coursePhotoInput = document.querySelector('[data-course-photo-input]');
    const coursePhotoPreview = document.querySelector('[data-course-photo-preview]');
    if (coursePhotoInput && coursePhotoPreview) {
        let previewUrl = '';
        coursePhotoInput.addEventListener('change', () => {
            const [file] = coursePhotoInput.files;
            if (!file) {
                return;
            }
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            previewUrl = URL.createObjectURL(file);
            coursePhotoPreview.src = previewUrl;
            coursePhotoPreview.hidden = false;
        });
    }

    if (video && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        video.pause();
    }

    document.querySelectorAll('[data-password-visibility]').forEach((button) => {
        const passwordInput = button.parentElement.querySelector('input[type="password"], input[type="text"]');
        if (!passwordInput) {
            return;
        }

        button.addEventListener('click', () => {
            const shouldShow = passwordInput.type === 'password';
            passwordInput.type = shouldShow ? 'text' : 'password';
            button.textContent = shouldShow ? 'Hide' : 'Show';
            button.setAttribute('aria-label', `${shouldShow ? 'Hide' : 'Show'} password`);
            button.setAttribute('aria-pressed', String(shouldShow));
        });
    });

    const homeHero = document.querySelector('.hero');
    const homeMain = homeHero ? homeHero.closest('main') : null;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (homeMain && !prefersReducedMotion.matches && 'IntersectionObserver' in window) {
        const revealSections = Array.from(homeMain.querySelectorAll(
            '.home-stats, .featured-section, .home-discover, .home-benefits, .home-cta'
        ));
        if (revealSections.length > 0) {
            homeMain.classList.add('has-scroll-reveal');
            revealSections.forEach((section) => section.setAttribute('data-scroll-reveal', ''));
            const revealObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-revealed');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
            revealSections.forEach((section) => revealObserver.observe(section));
            prefersReducedMotion.addEventListener('change', () => {
                if (prefersReducedMotion.matches) {
                    revealSections.forEach((section) => section.classList.add('is-revealed'));
                    revealObserver.disconnect();
                }
            });
        }
    }

    const compareButtons = Array.from(document.querySelectorAll('[data-compare-select]'));
    const compareTray = document.querySelector('[data-compare-tray]');
    const compareDialog = document.querySelector('[data-compare-dialog]');
    if (compareButtons.length > 0 && compareTray && compareDialog) {
        const compareCount = compareTray.querySelector('[data-compare-count]');
        const compareHint = compareTray.querySelector('[data-compare-hint]');
        const compareOpen = compareTray.querySelector('[data-compare-open]');
        const compareTable = compareDialog.querySelector('[data-compare-table]');
        const selectedCourses = new Map();

        const getCourseDetails = (button) => {
            const card = button.closest('.course-card');
            const metadata = Array.from(card.querySelectorAll('.course-meta'));
            const seats = Array.from(card.querySelectorAll('.course-seats span'));
            return {
                id: button.dataset.courseId,
                title: card.querySelector('h3').textContent.trim(),
                category: card.querySelector('.course-category').textContent.trim(),
                instructor: metadata[0].querySelector('strong').textContent.trim(),
                duration: metadata[1].querySelector('strong').textContent.trim(),
                enrolled: seats[0].textContent.trim(),
                places: seats[1].textContent.trim()
            };
        };

        const updateCompareTray = () => {
            const count = selectedCourses.size;
            compareTray.hidden = count === 0;
            compareCount.textContent = `${count} ${count === 1 ? 'course' : 'courses'} selected`;
            compareHint.textContent = count < 2
                ? 'Select one more course to compare.'
                : count === 3
                    ? 'You can compare up to 3 courses.'
                    : 'Select one more course, or compare these now.';
            compareOpen.disabled = count < 2;
            compareButtons.forEach((button) => {
                const isSelected = selectedCourses.has(button.dataset.courseId);
                button.setAttribute('aria-pressed', String(isSelected));
                button.querySelector('[data-compare-icon]').textContent = isSelected ? '✓' : '＋';
                button.querySelector('[data-compare-label]').textContent = isSelected ? 'Selected' : 'Compare';
            });
        };

        compareButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const courseId = button.dataset.courseId;
                if (selectedCourses.has(courseId)) {
                    selectedCourses.delete(courseId);
                } else if (selectedCourses.size < 3) {
                    selectedCourses.set(courseId, getCourseDetails(button));
                } else {
                    compareHint.textContent = 'Remove a selected course before adding another.';
                    return;
                }
                updateCompareTray();
            });
        });

        compareTray.querySelector('[data-compare-clear]').addEventListener('click', () => {
            selectedCourses.clear();
            updateCompareTray();
        });

        compareOpen.addEventListener('click', () => {
            if (selectedCourses.size < 2) {
                return;
            }

            const courses = Array.from(selectedCourses.values());
            const table = document.createElement('table');
            table.className = 'compare-table';
            const header = table.createTHead().insertRow();
            const emptyHeading = document.createElement('th');
            emptyHeading.scope = 'col';
            emptyHeading.textContent = 'Course details';
            header.append(emptyHeading);
            courses.forEach((course) => {
                const heading = document.createElement('th');
                heading.scope = 'col';
                const title = document.createElement('strong');
                title.textContent = course.title;
                heading.append(title);
                header.append(heading);
            });

            const rows = [
                ['Subject', 'category'],
                ['Instructor', 'instructor'],
                ['Duration', 'duration'],
                ['Enrolled', 'enrolled'],
                ['Availability', 'places']
            ];
            const body = table.createTBody();
            rows.forEach(([label, key]) => {
                const row = body.insertRow();
                const heading = document.createElement('th');
                heading.scope = 'row';
                heading.textContent = label;
                row.append(heading);
                courses.forEach((course) => {
                    const cell = row.insertCell();
                    cell.textContent = course[key];
                });
            });
            compareTable.replaceChildren(table);
            compareDialog.showModal();
        });

        compareDialog.querySelector('[data-compare-close]').addEventListener('click', () => {
            compareDialog.close();
        });

        updateCompareTray();
    }

    const underlinedWord = document.querySelector('[data-underline-word]');
    if (underlinedWord) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (reducedMotion.matches || !('IntersectionObserver' in window)) {
            underlinedWord.classList.add('is-visible');
        } else {
            const underlineObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        underlinedWord.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.6 });
            underlineObserver.observe(underlinedWord);
            reducedMotion.addEventListener('change', () => {
                if (reducedMotion.matches) {
                    underlinedWord.classList.add('is-visible');
                    underlineObserver.disconnect();
                }
            });
        }
    }

    const journey = document.querySelector('[data-journey]');
    if (journey) {
        const track = journey.querySelector('[data-journey-track]');
        const progressPath = journey.querySelector('[data-journey-progress]');
        const steps = Array.from(journey.querySelectorAll('[data-journey-step] .step-icon'));
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let journeyLength = 0;
        let journeyFrame = 0;

        const updateJourneyGeometry = () => {
            const journeyBounds = journey.getBoundingClientRect();
            const points = steps.map((step) => {
                const bounds = step.getBoundingClientRect();
                return {
                    x: bounds.left + bounds.width / 2 - journeyBounds.left,
                    y: bounds.top + bounds.height / 2 - journeyBounds.top
                };
            });

            if (points.length < 2 || journeyBounds.width === 0 || journeyBounds.height === 0) {
                return;
            }

            journey.setAttribute('viewBox', `0 0 ${journeyBounds.width} ${journeyBounds.height}`);
            const pathData = points.map((point, index) =>
                `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
            ).join(' ');
            track.setAttribute('d', pathData);
            progressPath.setAttribute('d', pathData);
            journeyLength = progressPath.getTotalLength();
            progressPath.style.strokeDasharray = String(journeyLength);
            updateJourneyProgress();
        };

        const updateJourneyProgress = () => {
            const bounds = journey.getBoundingClientRect();
            const scrollProgress = Math.min(1, Math.max(0,
                (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height)
            ));
            const progress = reducedMotion.matches ? 1 : scrollProgress;
            progressPath.style.strokeDashoffset = String(journeyLength * (1 - progress));
        };

        const scheduleJourneyUpdate = () => {
            if (journeyFrame) {
                return;
            }
            journeyFrame = window.requestAnimationFrame(() => {
                journeyFrame = 0;
                updateJourneyProgress();
            });
        };

        updateJourneyGeometry();
        window.addEventListener('scroll', scheduleJourneyUpdate, { passive: true });
        window.addEventListener('resize', updateJourneyGeometry);
        reducedMotion.addEventListener('change', scheduleJourneyUpdate);
        if ('ResizeObserver' in window) {
            const journeyObserver = new ResizeObserver(updateJourneyGeometry);
            journeyObserver.observe(journey);
            steps.forEach((step) => journeyObserver.observe(step));
        }
    }

    const favoriteButtons = Array.from(document.querySelectorAll('[data-favorite-button]'));
    const tools = document.querySelector('[data-favorites-tools]');
    if (favoriteButtons.length === 0 || !tools) {
        return;
    }

    const storageKey = 'coursehub:saved-courses';
    const filterButton = document.querySelector('[data-favorites-filter]');
    const favoriteCount = document.querySelector('[data-favorites-count]');
    const filterLabel = document.querySelector('[data-favorites-label]');
    const summary = document.querySelector('[data-favorites-summary]');
    const emptyState = document.querySelector('[data-favorites-empty]');
    const cards = favoriteButtons.map((button) => ({
        button,
        card: button.closest('.course-card')
    }));
    let favorites = new Set();
    let favoritesOnly = false;
    let storageAvailable = true;

    try {
        const storedFavorites = window.localStorage.getItem(storageKey);
        if (storedFavorites) {
            const parsedFavorites = JSON.parse(storedFavorites);
            if (!Array.isArray(parsedFavorites) || !parsedFavorites.every((id) => typeof id === 'string')) {
                throw new Error('Saved courses data is invalid.');
            }
            favorites = new Set(parsedFavorites);
        }
    } catch {
        storageAvailable = false;
        summary.textContent = 'Saved courses are unavailable in this browser. You can still save courses for this visit.';
    }

    tools.hidden = false;

    const renderFavorites = () => {
        let visibleCount = 0;
        cards.forEach(({ button, card }) => {
            const isFavorite = favorites.has(button.dataset.courseId);
            button.setAttribute('aria-pressed', String(isFavorite));
            button.setAttribute(
                'aria-label',
                `${isFavorite ? 'Remove' : 'Save'} ${button.dataset.courseTitle}${isFavorite ? ' from saved courses' : ''}`
            );
            button.querySelector('[data-favorite-icon]').textContent = isFavorite ? '★' : '☆';
            button.querySelector('[data-favorite-label]').textContent = isFavorite ? 'Saved' : 'Save course';
            card.hidden = favoritesOnly && !isFavorite;
            if (!card.hidden) {
                visibleCount += 1;
            }
        });

        filterButton.setAttribute('aria-pressed', String(favoritesOnly));
        filterLabel.textContent = favoritesOnly ? 'Show all courses' : 'Show saved courses';
        favoriteCount.textContent = String(favorites.size);
        emptyState.hidden = !favoritesOnly || visibleCount > 0;
        if (storageAvailable) {
            summary.textContent = `${visibleCount} of ${cards.length} courses shown`;
        }
    };

    favoriteButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextFavorites = new Set(favorites);
            const courseId = button.dataset.courseId;
            if (nextFavorites.has(courseId)) {
                nextFavorites.delete(courseId);
            } else {
                nextFavorites.add(courseId);
            }

            if (storageAvailable) {
                try {
                    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(nextFavorites)));
                } catch {
                    storageAvailable = false;
                    summary.textContent = 'Browser storage is unavailable. Changes will only last for this visit.';
                }
            }
            favorites = nextFavorites;
            renderFavorites();
            if (!storageAvailable) {
                summary.textContent = 'Browser storage is unavailable. Changes will only last for this visit.';
            }
        });
    });

    filterButton.addEventListener('click', () => {
        favoritesOnly = !favoritesOnly;
        renderFavorites();
    });

    renderFavorites();
})();
