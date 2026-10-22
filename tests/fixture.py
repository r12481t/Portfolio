"""Builds a throwaway copy of the site with SAMPLE topics and courses, so the Learning Library, topic pages, filters and
video box can be tested. Nothing here is written to the real repo. Used by learn_test.py and axe_run.py."""
import json, os, re, shutil, subprocess, sys, tempfile

def build(repo):
    dest = tempfile.mkdtemp(prefix='curiohatch-fixture-')
    shutil.copytree(repo, os.path.join(dest, 'site'), ignore=shutil.ignore_patterns('.git', 'node_modules', '__pycache__', '.env.local', '.env.*.local', '*.db', '.db-backups'))
    site = os.path.join(dest, 'site')
    topics = {"schema": 1, "topics": [
        {"id": "t001", "slug": "what-is-a-variable", "status": "published", "title": "What is a variable?", "summary": "A variable is a named box for a value. This lesson shows how to create one, change it and use it.", "category": "JavaScript basics", "subtopics": ["declaring", "assigning"], "tags": ["variables", "beginner"], "concepts": ["let and const", "assignment"], "videoId": "dQw4w9WgXcQ", "publishedAt": "2026-10-20", "updatedAt": "2026-10-22", "prerequisites": [], "related": ["t002", "t003"], "courses": ["c001"]},
        {"id": "t002", "slug": "loops-in-plain-words", "status": "published", "title": "Loops in plain words", "summary": "A loop repeats work so you do not have to write it twice.", "category": "JavaScript basics", "subtopics": [], "tags": ["loops", "beginner"], "concepts": ["for loop"], "videoId": "abcdefghijk", "publishedAt": "2026-10-27", "updatedAt": "", "prerequisites": ["t001"], "related": ["t001"], "courses": []},
        {"id": "t003", "slug": "unfinished-draft", "status": "drafted", "title": "Unfinished draft", "summary": "Draft summary.", "category": "CSS", "subtopics": [], "tags": ["draft"], "concepts": [], "videoId": "", "publishedAt": "", "updatedAt": "", "prerequisites": [], "related": [], "courses": []},
        {"id": "t004", "slug": "old-topic", "status": "archived", "title": "Old topic", "summary": "Archived.", "category": "CSS", "subtopics": [], "tags": [], "concepts": [], "videoId": "zzzzzzzzzzz", "publishedAt": "2026-09-01", "updatedAt": "", "prerequisites": [], "related": [], "courses": []},
        {"id": "t005", "slug": "later-idea", "status": "planned", "title": "Later idea", "summary": "", "category": "", "subtopics": [], "tags": [], "concepts": [], "videoId": "", "publishedAt": "", "updatedAt": "", "prerequisites": [], "related": [], "courses": []}]}
    courses = {"schema": 1, "courses": [
        {"id": "c001", "title": "Fixture course (test only)", "summary": "A planned path.", "status": "planned", "category": "JavaScript basics", "audience": "Beginners", "level": "Beginner"},
        {"id": "c002", "title": "Fixture live course", "summary": "Pretend live.", "status": "available", "url": "https://example.org/course"}]}
    json.dump(topics, open(os.path.join(site, 'content/learn/topics.json'), 'w'), indent=2)
    json.dump(courses, open(os.path.join(site, 'content/courses/courses.json'), 'w'), indent=2)
    tool = [sys.executable, os.path.join(site, 'tools/site.py')]
    subprocess.run(tool + ['sync'], check=True, capture_output=True)
    article = '<h2>Why variables exist</h2><p>' + ('A variable holds a value so the program can use it again later. ' * 50) + '</p>'
    for slug in ('what-is-a-variable', 'loops-in-plain-words'):
        p = os.path.join(site, 'learn', slug, 'index.html')
        t = open(p, encoding='utf-8').read()
        t = re.sub(r'<!-- ARTICLE:START -->.*?<!-- ARTICLE:END -->', lambda m: '<!-- ARTICLE:START -->' + article + '<!-- ARTICLE:END -->', t, flags=re.S)
        open(p, 'w', encoding='utf-8').write(t)
    subprocess.run(tool + ['sync'], check=True, capture_output=True)
    return site

if __name__ == '__main__':
    print(build(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..'))))
