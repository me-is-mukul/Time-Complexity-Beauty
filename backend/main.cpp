#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <unordered_set>
#include <iomanip>
#include <stdexcept>
#include <cctype>

using namespace std;

class TextProcessor {
public:
    static vector<string> tokenize(const string& text) {
        vector<string> tokens;
        string word;

        for (char c : text) {
            if (isalnum(c)) {
                word += tolower(c);
            } else {
                if (!word.empty()) {
                    tokens.push_back(word);
                    word.clear();
                }
            }
        }

        if (!word.empty()) tokens.push_back(word);
        return tokens;
    }

    static vector<string> generateShingles(const vector<string>& tokens, int k) {
        vector<string> shingles;

        if (tokens.size() < k) return shingles;

        for (size_t i = 0; i + k <= tokens.size(); ++i) {
            string shingle;
            for (int j = 0; j < k; ++j) {
                shingle += tokens[i + j] + " ";
            }
            shingles.push_back(shingle);
        }

        return shingles;
    }
};


class Hasher {
private:
    const long long base = 31;
    const long long mod = 1e9 + 9;

public:
    long long computeHash(const string& s) {
        long long hash = 0;
        long long power = 1;

        for (char c : s) {
            hash = (hash + (c * power) % mod) % mod;
            power = (power * base) % mod;
        }

        return hash;
    }
};


class PlagiarismChecker {
private:
    int k; // shingle size
    Hasher hasher;

public:
    PlagiarismChecker(int k = 3) : k(k) {}

    unordered_set<long long> processText(const string& text) {
        auto tokens = TextProcessor::tokenize(text);
        auto shingles = TextProcessor::generateShingles(tokens, k);

        unordered_set<long long> hashedSet;

        for (const auto& shingle : shingles) {
            hashedSet.insert(hasher.computeHash(shingle));
        }

        return hashedSet;
    }

    double computeSimilarity(const unordered_set<long long>& A,
                             const unordered_set<long long>& B) {

        if (A.empty() && B.empty()) return 1.0;

        int intersection = 0;

        for (const auto& h : A) {
            if (B.count(h)) intersection++;
        }

        int unionSize = A.size() + B.size() - intersection;

        return (double)intersection / unionSize;
    }

    pair<double, bool> check(const string& text1,
                             const string& text2,
                             double threshold = 0.30) {

        auto setA = processText(text1);
        auto setB = processText(text2);

        double similarity = computeSimilarity(setA, setB);
        bool flag = similarity >= threshold;

        return {similarity * 100.0, flag};
    }
};

string readFile(const string& filename) {
    ifstream file(filename);
    if (!file) {
        throw runtime_error("Failed to open file: " + filename);
    }

    stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

/*
 * Entry point
 */
int main(int argc, char* argv[]) {
    if (argc != 3) {
        cerr << "Usage: ./plag <file1> <file2>\n";
        return 1;
    }

    try {
        string text1 = readFile(argv[1]);
        string text2 = readFile(argv[2]);

        PlagiarismChecker checker(2); // k = 3 word shingles
        auto result = checker.check(text1, text2);

        cout << fixed << setprecision(2);
        cout << result.first << " " << result.second << "\n";

    } catch (const exception& e) {
        cerr << e.what() << "\n";
        return 1;
    }

    return 0;
}