const DEMO_SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

function lesson(title, summary, content, durationMinutes, videoUrl = '') {
    return { title, summary, content, durationMinutes, videoUrl };
}

function twoModules(moduleOneTitle, lessonsOne, moduleTwoTitle, lessonsTwo) {
    return [
        { title: moduleOneTitle, lessons: lessonsOne },
        { title: moduleTwoTitle, lessons: lessonsTwo }
    ];
}

function buildStarterCurriculum(title, description) {
    return [{
        title: 'Getting started',
        lessons: [
            lesson(
                `Welcome to ${title}`,
                'Course overview and how to use the learning pages.',
                `Welcome to ${title}. After you enroll, open each lesson from the course curriculum to read the material, watch any linked video, and download attached files. Mark a lesson complete when you are done to track your progress across My learning and My courses.`,
                10,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Course goals',
                'What this course covers.',
                description,
                15
            )
        ]
    }];
}

function isGenericStarterCurriculum(modules, title) {
    if (!Array.isArray(modules) || modules.length !== 1) {
        return false;
    }
    const [module] = modules;
    if (module.title !== 'Getting started' || !Array.isArray(module.lessons) || module.lessons.length !== 2) {
        return false;
    }
    return module.lessons[0].title === `Welcome to ${title}` &&
        module.lessons[1].title === 'Course goals';
}

const curriculumByCourseCode = {
    'DBMS-101': [
        {
            title: 'Introduction to database systems',
            lessons: [
                lesson(
                    'What is a DBMS?',
                    'Purpose of database management systems in applications.',
                    'A Database Management System (DBMS) stores data in a structured way so many users and programs can query and update it safely. Examples include MySQL, PostgreSQL, and MongoDB. A DBMS provides concurrency control, crash recovery, and access control.',
                    20,
                    DEMO_SAMPLE_VIDEO
                ),
                lesson(
                    'Files versus databases',
                    'Why teams move from flat files to relational databases.',
                    'Flat files are simple but make consistency and shared access difficult. Relational databases use tables, keys, and constraints to reduce duplication and enforce rules such as valid foreign references between students and enrollments.',
                    25
                )
            ]
        },
        {
            title: 'Relational model and SQL',
            lessons: [
                lesson(
                    'Tables, keys, and relationships',
                    'Entities, primary keys, foreign keys, and normalization basics.',
                    'Each table represents an entity. Primary keys uniquely identify rows; foreign keys link tables. First normal form removes repeating groups; higher normal forms reduce redundancy while preserving meaning.',
                    30
                ),
                lesson(
                    'Writing SELECT queries',
                    'Retrieve data with filtering, sorting, and joins.',
                    'SELECT reads columns from tables. WHERE filters rows, ORDER BY sorts, and INNER JOIN connects related rows on matching keys. Try: SELECT name, email FROM students WHERE department = \'CSE\';',
                    35
                )
            ]
        },
        {
            title: 'Design and transactions',
            lessons: [
                lesson(
                    'ER diagrams to schema',
                    'From entities and relationships to CREATE TABLE statements.',
                    'Model entities as tables and relationships as foreign keys or link tables. Document cardinality (one-to-many, many-to-many) before writing DDL so applications can query predictably.',
                    25
                ),
                lesson(
                    'Transactions and ACID',
                    'Keep updates safe when many users write at once.',
                    'A transaction groups changes that must succeed or fail together. ACID properties are Atomicity, Consistency, Isolation, and Durability—essential for banking, enrollment, and inventory systems.',
                    30
                )
            ]
        }
    ],
    'WEB-110': twoModules(
        'Web platform basics',
        [
            lesson(
                'How the web works',
                'Browsers, HTTP, and the request-response cycle.',
                'When you visit a URL, the browser sends an HTTP request to a server. The server returns HTML, which the browser parses into the DOM. CSS styles the page and JavaScript adds interactivity.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'HTML document structure',
                'Semantic tags, headings, lists, and links.',
                'Use <!DOCTYPE html>, <head>, and <body>. Prefer semantic elements such as <header>, <main>, and <article>. Accessible pages use meaningful headings and alt text on images.',
                25
            )
        ],
        'Styling and scripting',
        [
            lesson(
                'CSS layout fundamentals',
                'Box model, flexbox, and responsive design.',
                'Every element is a box with content, padding, border, and margin. Flexbox aligns items in rows or columns. Media queries adjust layouts for phones and desktops.',
                30
            ),
            lesson(
                'JavaScript in the browser',
                'DOM events, fetch, and simple form validation.',
                'document.querySelector selects elements. addEventListener handles clicks and input. fetch can load JSON from an API to update the page without a full reload.',
                35
            )
        ]
    ),
    'DSA-120': twoModules(
        'Core structures',
        [
            lesson(
                'Arrays and linked lists',
                'Trade-offs between contiguous memory and pointers.',
                'Arrays offer O(1) indexed access but costly inserts in the middle. Linked lists insert in O(1) when you hold a node reference but require O(n) traversal to reach an index.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Stacks and queues',
                'LIFO and FIFO patterns in real programs.',
                'Stacks model undo history and call stacks. Queues model print jobs and message buffers. Both can be built with arrays or linked lists.',
                20
            )
        ],
        'Algorithms',
        [
            lesson(
                'Big-O intuition',
                'Describe growth of time and space as input size increases.',
                'O(1) is constant time, O(log n) often comes from halving a search space, O(n) scans all items once, and O(n log n) appears in efficient sorting. Prefer the simplest structure that meets performance needs.',
                30
            ),
            lesson(
                'Sorting and searching',
                'Binary search, merge sort, and when to use each.',
                'Binary search needs a sorted array and runs in O(log n). Merge sort guarantees O(n log n) time. For small datasets, simpler algorithms may be fast enough and easier to maintain.',
                35
            )
        ]
    ),
    'PY-130': twoModules(
        'Python foundations',
        [
            lesson(
                'Variables and control flow',
                'Types, if/else, and loops.',
                'Python uses indentation for blocks. Lists and dictionaries are common collections. Write small scripts that read input, branch on conditions, and iterate with for and while.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Functions and modules',
                'Reuse logic and organize code into files.',
                'Define functions with def and document them with docstrings. Import modules such as math or datetime. Keep functions focused on one task.',
                25
            )
        ],
        'Working with data',
        [
            lesson(
                'Files and exceptions',
                'Read text safely and handle errors.',
                'Use with open(...) as f to read and write files. try/except catches predictable failures such as missing files or invalid numbers without crashing the whole program.',
                25
            ),
            lesson(
                'Mini project: grade tracker',
                'Combine lists, dictionaries, and file I/O.',
                'Store student records in a list of dictionaries, compute averages, and save results to a CSV. This mirrors how small academic tools are built before moving to a database.',
                30
            )
        ]
    ),
    'JAVA-140': twoModules(
        'Object-oriented Java',
        [
            lesson(
                'Classes and objects',
                'Fields, methods, and constructors.',
                'A class describes data and behavior. new creates an object instance. Encapsulation hides fields behind methods so invariants stay valid.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Inheritance and polymorphism',
                'Extend behavior without duplicating code.',
                'Subclasses override methods to specialize behavior. Use interfaces when unrelated classes share a capability, such as Printable or Comparable.',
                30
            )
        ],
        'Application building',
        [
            lesson(
                'Collections framework',
                'ArrayList, HashMap, and choosing structures.',
                'ArrayList gives dynamic arrays; HashMap maps keys to values in average O(1) time. Pick structures based on access patterns in your problem.',
                25
            ),
            lesson(
                'Console app walkthrough',
                'Putting classes together in a small enrollment demo.',
                'Model Student and Course classes, store enrollments in a collection, and expose menu-driven commands. This pattern mirrors larger Spring or Android apps.',
                35
            )
        ]
    ),
    'JS-150': twoModules(
        'Language essentials',
        [
            lesson(
                'Values, functions, and scope',
                'let, const, and arrow functions.',
                'JavaScript has primitive types and objects. const prevents rebinding; let is block-scoped. Arrow functions capture this lexically in many callbacks.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Arrays and objects in practice',
                'map, filter, and destructuring.',
                'Use map to transform lists and filter to keep matching items. Destructuring pulls fields from objects cleanly: const { title, duration } = course.',
                25
            )
        ],
        'Browser programming',
        [
            lesson(
                'Events and the DOM',
                'Update pages reactively.',
                'Select nodes, attach listeners, and update text or classes. Prefer event delegation on parent elements for dynamic lists such as course cards.',
                30
            ),
            lesson(
                'Fetch and JSON',
                'Load data from APIs asynchronously.',
                'async/await with fetch simplifies HTTP calls. Always check response.ok and parse JSON inside try/catch so UI errors are friendly.',
                30
            )
        ]
    ),
    'HTML-160': twoModules(
        'Structure and accessibility',
        [
            lesson(
                'Semantic HTML',
                'Meaningful tags for people and assistive tech.',
                'Use headings in order, label form fields, and provide alt text. Landmarks like <nav> and <main> help screen readers skip efficiently.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Forms and validation attributes',
                'Collect user input with built-in hints.',
                'required, type="email", and minlength give free client-side checks. Always validate again on the server for security.',
                25
            )
        ],
        'CSS for layout',
        [
            lesson(
                'Selectors and the cascade',
                'Target elements predictably.',
                'Combine classes and pseudo-classes such as :focus-visible. Keep specificity low so theme changes stay easy.',
                25
            ),
            lesson(
                'Responsive pages',
                'Mobile-first layouts with flex and grid.',
                'Start with a single column, then use min-width media queries for wider screens. Test tap targets and readable font sizes on phones.',
                30
            )
        ]
    ),
    'SQL-170': twoModules(
        'Querying data',
        [
            lesson(
                'SELECT, WHERE, and ORDER BY',
                'Read and filter rows.',
                'SELECT columns FROM table WHERE condition ORDER BY column. Use LIMIT for paging through large result sets.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Aggregations and GROUP BY',
                'Summarize data with COUNT and AVG.',
                'GROUP BY buckets rows; HAVING filters groups after aggregation. Example: count enrollments per course_id.',
                30
            )
        ],
        'Combining tables',
        [
            lesson(
                'INNER and LEFT JOIN',
                'Connect related tables on keys.',
                'INNER JOIN keeps only matching rows. LEFT JOIN preserves all rows from the left table, filling NULL when no match exists—useful for optional relationships.',
                35
            ),
            lesson(
                'Subqueries and views',
                'Reuse complex logic safely.',
                'Subqueries nest SELECT statements inside WHERE or FROM. Views store a named query for reporting without duplicating SQL in every report.',
                30
            )
        ]
    ),
    'AI-180': twoModules(
        'AI foundations',
        [
            lesson(
                'What is artificial intelligence?',
                'Goals, history, and modern applications.',
                'AI systems perceive, reason, and act. Rule-based expert systems gave way to statistical learning and deep networks used in vision, speech, and recommendation.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Search and state spaces',
                'Breadth-first and A* intuition.',
                'Model problems as states and actions. Uninformed search explores blindly; heuristics guide A* toward promising paths in puzzles and planning.',
                30
            )
        ],
        'Knowledge and learning',
        [
            lesson(
                'Knowledge representation',
                'Facts, rules, and uncertainty.',
                'Logic expresses crisp rules; probability handles noise. Bayes’ rule updates beliefs when new evidence arrives.',
                25
            ),
            lesson(
                'Intro to machine learning',
                'Supervised vs unsupervised tasks.',
                'Supervised learning maps labeled examples to outputs. Unsupervised learning finds structure such as clusters without labels.',
                30
            )
        ]
    ),
    'ML-190': twoModules(
        'Supervised learning',
        [
            lesson(
                'Regression and classification',
                'Predict numbers or categories.',
                'Linear regression fits a line to numeric targets. Logistic regression estimates class probabilities. Always split data into train and test sets.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Bias, variance, and metrics',
                'Measure models honestly.',
                'Accuracy alone misleads on imbalanced data. Use precision, recall, and F1. Cross-validation estimates generalization before deployment.',
                30
            )
        ],
        'Model workflow',
        [
            lesson(
                'Feature engineering',
                'Turn raw fields into useful inputs.',
                'Encode categories, scale numeric columns, and handle missing values. Good features often beat complex algorithms on small datasets.',
                25
            ),
            lesson(
                'End-to-end sklearn demo',
                'Train and evaluate a simple classifier.',
                'Load a tabular dataset, split features and labels, fit a model, and report metrics. Save the pipeline for consistent preprocessing in production.',
                35
            )
        ]
    ),
    'DS-201': twoModules(
        'Data workflow',
        [
            lesson(
                'The data science process',
                'Question, data, model, communicate.',
                'Start with a business or research question. Document assumptions, explore data, iterate on models, and explain results to non-technical stakeholders.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Cleaning messy tables',
                'Handle nulls, types, and duplicates.',
                'Profile columns for missing rates and outliers. Standardize dates and categories before analysis so charts and models are trustworthy.',
                30
            )
        ],
        'Exploration and storytelling',
        [
            lesson(
                'Exploratory analysis',
                'Distributions, correlations, and segments.',
                'Histograms show spread; scatter plots reveal relationships. Segment users or courses to find patterns averages hide.',
                30
            ),
            lesson(
                'Presenting insights',
                'Charts that support decisions.',
                'One message per visual, clear axes, and honest scales. Pair a chart with a short recommendation and limitations.',
                25
            )
        ]
    ),
    'STAT-210': twoModules(
        'Probability basics',
        [
            lesson(
                'Events and probability rules',
                'Union, intersection, and conditional probability.',
                'P(A|B) updates beliefs when B is known. Independence means P(A∩B) = P(A)P(B). Use trees for small sequential experiments.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Random variables',
                'Expectation and variance.',
                'Discrete variables take countable outcomes; continuous variables take ranges. Expectation is a long-run average; variance measures spread.',
                30
            )
        ],
        'Inference',
        [
            lesson(
                'Sampling and the CLT',
                'Why averages look normal.',
                'Sample means from large samples tend toward a normal distribution even when raw data are skewed, enabling confidence intervals.',
                25
            ),
            lesson(
                'Hypothesis testing outline',
                'Null and alternative hypotheses.',
                'Choose a test statistic, compute a p-value, and decide using a significance level. Always report effect size, not just significance.',
                30
            )
        ]
    ),
    'OS-220': twoModules(
        'Processes and CPU',
        [
            lesson(
                'Processes vs threads',
                'Execution units and isolation.',
                'Processes have separate memory spaces; threads share memory within a process. The kernel schedules time slices to create the illusion of parallelism.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Scheduling algorithms',
                'FCFS, round robin, and priorities.',
                'Round robin prevents starvation on interactive systems. Priorities help real-time tasks but can starve low-priority work without aging.',
                30
            )
        ],
        'Memory and storage',
        [
            lesson(
                'Virtual memory',
                'Paging and address translation.',
                'Each process sees a virtual address space mapped to physical frames. Page faults load data from disk—fast disks and good locality matter.',
                30
            ),
            lesson(
                'Filesystems overview',
                'Files, directories, and permissions.',
                'Filesystems track metadata and data blocks. POSIX permissions (read/write/execute) combine with user/group/other bits to protect files.',
                25
            )
        ]
    ),
    'NET-230': twoModules(
        'Layered networks',
        [
            lesson(
                'OSI and TCP/IP models',
                'Where protocols live.',
                'Application protocols like HTTP sit above transport (TCP/UDP), network (IP), and link layers. Encapsulation wraps payloads with headers at each hop.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'IP addressing and routing',
                'Packets find their path.',
                'IPv4 addresses identify hosts on a network. Routers forward packets using routing tables built from static routes or dynamic protocols.',
                30
            )
        ],
        'Application protocols',
        [
            lesson(
                'DNS and HTTP',
                'Names to addresses and web requests.',
                'DNS resolves hostnames. HTTP methods (GET, POST) carry verbs; status codes signal success or errors. HTTPS adds TLS encryption.',
                30
            ),
            lesson(
                'Sockets introduction',
                'Endpoints for networked programs.',
                'A socket is an IP plus port. Client/server programs bind, listen, connect, and exchange bytes—foundation for chat and game servers.',
                25
            )
        ]
    ),
    'SEC-240': twoModules(
        'Security mindset',
        [
            lesson(
                'CIA triad and threats',
                'Confidentiality, integrity, availability.',
                'Attackers target weak passwords, unpatched software, and misconfigured cloud buckets. Threat modeling lists assets, adversaries, and mitigations early.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Authentication basics',
                'Passwords, MFA, and sessions.',
                'Store password hashes with salt using slow algorithms. Multi-factor authentication blocks many credential-stuffing attacks. Rotate session tokens on login.',
                30
            )
        ],
        'Defensive practice',
        [
            lesson(
                'Common web vulnerabilities',
                'Injection and XSS at a glance.',
                'Parameterized queries prevent SQL injection. Encode output and use Content Security Policy to reduce cross-site scripting risk.',
                30
            ),
            lesson(
                'Secure development habits',
                'Least privilege and logging.',
                'Grant minimal permissions to services and database accounts. Log authentication events and monitor anomalies without storing secrets in logs.',
                25
            )
        ]
    ),
    'CLOUD-250': twoModules(
        'Cloud concepts',
        [
            lesson(
                'IaaS, PaaS, and SaaS',
                'Who manages what.',
                'IaaS gives virtual machines you configure. PaaS runs your code without managing servers. SaaS delivers ready applications like email or CRM.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Regions, zones, and elasticity',
                'Scale out instead of up.',
                'Deploy across availability zones for resilience. Auto scaling groups add instances when load grows and remove them when idle to control cost.',
                25
            )
        ],
        'Building on cloud',
        [
            lesson(
                'Containers vs VMs',
                'Lightweight packaging for apps.',
                'Containers share the host kernel and start quickly. Orchestrators like Kubernetes schedule replicas and rolling updates.',
                30
            ),
            lesson(
                'Twelve-factor app ideas',
                'Config, logs, and stateless processes.',
                'Store configuration in environment variables, treat logs as streams, and keep application processes stateless so horizontal scaling works.',
                25
            )
        ]
    ),
    'UX-260': twoModules(
        'Research and structure',
        [
            lesson(
                'User research methods',
                'Interviews, surveys, and usability tests.',
                'Ask open questions, observe tasks without leading users, and synthesize pain points into themes before sketching screens.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Information architecture',
                'Organize content so users find tasks.',
                'Card sorting reveals mental models. Clear navigation labels and breadcrumbs reduce disorientation in multi-step flows like enrollment.',
                25
            )
        ],
        'Design and validation',
        [
            lesson(
                'Wireframes to prototypes',
                'Low fidelity before pixels.',
                'Start with grayscale layouts focusing on hierarchy and flow. Interactive prototypes test click paths before visual polish.',
                30
            ),
            lesson(
                'Accessibility in UI',
                'Contrast, focus, and touch targets.',
                'WCAG contrast ratios keep text readable. Visible focus rings and 44px touch targets help keyboard and mobile users equally.',
                25
            )
        ]
    ),
    'MOB-270': twoModules(
        'Mobile UX',
        [
            lesson(
                'Platform patterns',
                'Navigation on small screens.',
                'Use tab bars for top-level sections and stack navigation for drill-down. Respect platform conventions on iOS and Android.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Designing for touch',
                'Gestures, spacing, and feedback.',
                'Provide immediate visual feedback on taps. Avoid tiny controls; place primary actions within thumb reach on large phones.',
                25
            )
        ],
        'Implementation basics',
        [
            lesson(
                'API-driven mobile apps',
                'Fetch course lists from a backend.',
                'Mobile clients consume JSON over HTTPS, cache responses, and handle offline states gracefully with clear messaging.',
                30
            ),
            lesson(
                'Publishing checklist',
                'Icons, permissions, and privacy labels.',
                'Declare only necessary permissions. Write store descriptions that match actual data collection to pass review and build trust.',
                25
            )
        ]
    ),
    'GIT-280': twoModules(
        'Version control',
        [
            lesson(
                'Repositories and commits',
                'Snapshots with messages.',
                'git init creates a repo; git add stages changes; git commit records a snapshot. Write messages that explain why, not only what.',
                15,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Branches and merges',
                'Parallel workstreams.',
                'Feature branches isolate work. Merge or rebase to integrate. Resolve conflicts carefully and rerun tests before pushing.',
                20
            )
        ],
        'Collaboration',
        [
            lesson(
                'Remotes, push, and pull',
                'Share history with a team.',
                'origin tracks the shared remote. Pull before push to reduce conflicts. Use .gitignore to keep build artifacts out of history.',
                20
            ),
            lesson(
                'Pull requests and review',
                'Quality gates before main.',
                'Small PRs are easier to review. Describe testing performed and link issues. Reviews catch bugs and spread knowledge.',
                20
            )
        ]
    ),
    'DSA-290': twoModules(
        'Problem solving',
        [
            lesson(
                'Breaking down prompts',
                'Examples, edge cases, and invariants.',
                'Restate the problem, list constraints, and walk through tiny examples before coding. Identify invariants your loop must maintain.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Recursion patterns',
                'Base cases and trust the call stack.',
                'Every recursive function needs a base case and progress toward it. Draw recursion trees for merge sort or tree traversals.',
                30
            )
        ],
        'Complexity in practice',
        [
            lesson(
                'Two-pointer techniques',
                'Linear scans that avoid nested loops.',
                'Sorted arrays enable left/right pointers to find pairs in O(n). Same idea applies to string palindrome checks.',
                25
            ),
            lesson(
                'Practice contest walkthrough',
                'Simulate a timed problem set.',
                'Spend five minutes understanding, fifteen implementing, five testing edge cases. Track time complexity and memory usage in comments.',
                35
            )
        ]
    ),
    'IOT-301': twoModules(
        'Connected devices',
        [
            lesson(
                'Sensors and actuators',
                'Physical world to digital signals.',
                'Temperature sensors produce analog values converted by ADCs. Actuators such as relays switch motors or lights based on controller logic.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Microcontrollers overview',
                'Firmware loops and peripherals.',
                'A typical loop reads sensors, applies logic, and writes outputs. UART, I2C, and SPI connect chips on a small board.',
                25
            )
        ],
        'Systems view',
        [
            lesson(
                'MQTT and telemetry',
                'Lightweight publish/subscribe messaging.',
                'Devices publish readings to topics; dashboards subscribe. QoS levels trade delivery guarantees for bandwidth on slow links.',
                30
            ),
            lesson(
                'Security at the edge',
                'Updates, credentials, and segmentation.',
                'Ship signed firmware updates. Avoid hard-coded passwords; use device certificates and isolate IoT VLANs from office networks.',
                25
            )
        ]
    ),
    'SE-310': twoModules(
        'Software lifecycle',
        [
            lesson(
                'Requirements and user stories',
                'Capture needs testably.',
                'User stories follow “As a … I want … so that …”. Acceptance criteria define done for enrollment, payments, or admin workflows.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Design and architecture',
                'Modules, APIs, and trade-offs.',
                'Layer UI, business logic, and data access. Document API contracts so frontend and backend teams integrate without surprises.',
                30
            )
        ],
        'Quality and delivery',
        [
            lesson(
                'Testing pyramid',
                'Unit, integration, and end-to-end.',
                'Many fast unit tests, fewer integration tests hitting real databases, and a handful of E2E flows for critical paths like signup.',
                25
            ),
            lesson(
                'Agile ceremonies',
                'Sprints, stand-ups, and retrospectives.',
                'Plan short iterations, demo working software, and inspect process in retros. Continuous integration catches regressions early.',
                25
            )
        ]
    ),
    'BIG-320': twoModules(
        'Big data landscape',
        [
            lesson(
                'Volume, velocity, variety',
                'Why batch and stream differ.',
                'Batch systems like Hadoop process historical logs. Stream processors handle live clicks or sensor feeds with low latency.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Distributed storage',
                'HDFS and object stores.',
                'Data is replicated across nodes for fault tolerance. Object storage (S3-like) holds large files; query engines read them in place.',
                30
            )
        ],
        'Processing',
        [
            lesson(
                'MapReduce intuition',
                'Split, map, shuffle, reduce.',
                'Mappers emit key-value pairs; reducers aggregate by key. Modern engines optimize this pattern behind SQL or DataFrame APIs.',
                30
            ),
            lesson(
                'Data pipelines',
                'ETL into a warehouse.',
                'Extract from operational DBs, transform with cleansing rules, and load into analytics tables for dashboards and ML features.',
                25
            )
        ]
    ),
    'LINUX-330': twoModules(
        'Shell essentials',
        [
            lesson(
                'Navigation and permissions',
                'ls, cd, chmod, and chown.',
                'Paths can be absolute or relative. Permission bits control read, write, and execute for user, group, and others on files and directories.',
                20,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Pipes and redirection',
                'Compose small tools.',
                'command1 | command2 passes stdout as stdin. > writes to files; >> appends. grep, sort, and wc become powerful together.',
                25
            )
        ],
        'Scripting',
        [
            lesson(
                'Bash scripts',
                'Automate repetitive tasks.',
                'Use #!/bin/bash, variables in $VAR, and if/for constructs. Quote variables to handle spaces safely.',
                25
            ),
            lesson(
                'Processes and services',
                'ps, top, systemd basics.',
                'Signals stop or restart daemons. systemctl start|status manages services that should survive reboots.',
                20
            )
        ]
    ),
    'MATH-340': twoModules(
        'Logic and sets',
        [
            lesson(
                'Propositions and truth tables',
                'AND, OR, NOT, and implications.',
                'Logical equivalence lets you simplify expressions. Implication p → q is false only when p is true and q is false.',
                25,
                DEMO_SAMPLE_VIDEO
            ),
            lesson(
                'Sets and functions',
                'Union, intersection, and bijections.',
                'Functions map inputs to exactly one output. Injective, surjective, and bijective functions underlie counting and cryptography proofs.',
                25
            )
        ],
        'Graphs and counting',
        [
            lesson(
                'Graph terminology',
                'Vertices, edges, paths, and cycles.',
                'Trees are acyclic connected graphs. Euler and Hamilton paths appear in routing and puzzle problems.',
                30
            ),
            lesson(
                'Combinatorics intro',
                'Permutations and combinations.',
                'nPr ordered selections; nCr unordered groups. Inclusion-exclusion counts elements avoiding double counting.',
                30
            )
        ]
    )
};

module.exports = {
    buildStarterCurriculum,
    curriculumByCourseCode,
    isGenericStarterCurriculum
};
