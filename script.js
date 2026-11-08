/**
 * Horizon Web Studio — Cinematic Monochrome Space Theme
 * JavaScript for Custom Spacecraft Cursor, Starfield, Navigation, and Form Interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 0. Theme & Accessibility Settings Toggles
    const themeToggle = document.getElementById('themeToggle');
    const motionToggle = document.getElementById('motionToggle');

    // Load saved Theme preference (default: dark)
    const savedTheme = localStorage.getItem('horizon_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Load saved Reduce Motion preference
    const savedMotion = localStorage.getItem('horizon_reduce_motion');
    const systemPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMotionReduced = savedMotion !== null ? savedMotion === 'true' : systemPrefersReducedMotion;

    if (isMotionReduced) {
        document.body.setAttribute('data-reduce-motion', 'true');
        if (motionToggle) motionToggle.classList.add('active');
    } else {
        document.body.setAttribute('data-reduce-motion', 'false');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('horizon_theme', newTheme);
        });
    }

    if (motionToggle) {
        motionToggle.addEventListener('click', () => {
            const currentMotion = document.body.getAttribute('data-reduce-motion');
            const newMotion = currentMotion === 'true' ? 'false' : 'true';
            document.body.setAttribute('data-reduce-motion', newMotion);
            localStorage.setItem('horizon_reduce_motion', newMotion);
            motionToggle.classList.toggle('active', newMotion === 'true');
        });
    }

    // 1. Starfield Generator for Cinematic Space Hero
    const starsContainer = document.getElementById('starsContainer');
    if (starsContainer) {
        const starCount = 60;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.classList.add('star');
            const size = Math.random() * 2.5 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.left = `${Math.random() * 100}%`;
            star.style.animationDuration = `${Math.random() * 3 + 2}s`;
            star.style.animationDelay = `${Math.random() * 5}s`;
            starsContainer.appendChild(star);
        }
    }

    // 2. Custom Spacecraft Cursor
    const cursor = document.getElementById('spacecraftCursor');
    if (cursor && window.innerWidth >= 1024) {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let cursorX = mouseX;
        let cursorY = mouseY;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        // Smooth follow animation (lerp)
        function renderCursor() {
            cursorX += (mouseX - cursorX) * 0.2;
            cursorY += (mouseY - cursorY) * 0.2;
            cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
            requestAnimationFrame(renderCursor);
        }
        requestAnimationFrame(renderCursor);

        // Hover effects on interactive elements using event delegation
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('a, button, input, select, textarea, .btn, .service-card, .project-item, .contact-link-row, .icon-toggle-btn')) {
                cursor.classList.add('hovering');
            }
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('a, button, input, select, textarea, .btn, .service-card, .project-item, .contact-link-row, .icon-toggle-btn')) {
                cursor.classList.remove('hovering');
            }
        });
    }

    // 3. Header Scrolled State
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 30) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 4. Mobile Menu Toggle
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // 5. Active Nav Link on Scroll
    const sections = document.querySelectorAll('section[id]');
    function highlightNavOnScroll() {
        const scrollY = window.pageYOffset;
        sections.forEach(section => {
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.offsetTop - 120;
            const sectionId = section.getAttribute('id');
            const correspondingLink = document.querySelector(`.nav-menu a[href*="${sectionId}"]`);

            if (correspondingLink) {
                if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                    correspondingLink.classList.add('active');
                } else {
                    correspondingLink.classList.remove('active');
                }
            }
        });
    }
    window.addEventListener('scroll', highlightNavOnScroll);

    // 6. Contact Form Handling (Honest Static Implementation)
    const contactForm = document.getElementById('contactForm');
    const formFeedback = document.getElementById('formFeedback');
    const mailtoString = document.getElementById('mailtoString');

    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const projectType = document.getElementById('projectType').value;
            const message = document.getElementById('message').value.trim();

            if (!name || !email || !message) {
                alert('Please fill out all required fields.');
                return;
            }

            const subject = encodeURIComponent(`Horizon Studio Inquiry: ${projectType} from ${name}`);
            const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nProject Type: ${projectType}\n\nMessage:\n${message}`);
            if (mailtoString) {
                mailtoString.href = `mailto:hussainmugal10@gmail.com?subject=${subject}&body=${body}`;
            }

            contactForm.reset();
            if (formFeedback) {
                formFeedback.classList.remove('hidden');
                formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
