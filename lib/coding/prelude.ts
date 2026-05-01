// C++ prelude written next to user code at compile time. Provides nlohmann/json,
// LeetCode-shape TreeNode/ListNode definitions, and JSON ↔ struct helpers so the
// per-problem harness can deserialize parameters and serialize return values.

export const CPP_PRELUDE_HEADER = String.raw`// === Auto-generated prelude (do not edit) ===
#pragma once
#include <bits/stdc++.h>
#include "json.hpp"

using namespace std;
using json = nlohmann::json;

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right)
        : val(x), left(left), right(right) {}
};

struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

inline TreeNode* treeFromJson(const json& arr) {
    if (arr.is_null() || !arr.is_array() || arr.empty()) return nullptr;
    if (arr[0].is_null()) return nullptr;
    auto* root = new TreeNode(arr[0].get<int>());
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < arr.size()) {
        TreeNode* node = q.front();
        q.pop();
        if (i < arr.size()) {
            if (!arr[i].is_null()) {
                node->left = new TreeNode(arr[i].get<int>());
                q.push(node->left);
            }
            i++;
        }
        if (i < arr.size()) {
            if (!arr[i].is_null()) {
                node->right = new TreeNode(arr[i].get<int>());
                q.push(node->right);
            }
            i++;
        }
    }
    return root;
}

inline json treeToJson(TreeNode* root) {
    json out = json::array();
    if (!root) return out;
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* n = q.front();
        q.pop();
        if (n) {
            out.push_back(n->val);
            q.push(n->left);
            q.push(n->right);
        } else {
            out.push_back(nullptr);
        }
    }
    while (!out.empty() && out.back().is_null()) out.erase(out.end() - 1);
    return out;
}

inline ListNode* listFromJson(const json& arr) {
    if (!arr.is_array() || arr.empty()) return nullptr;
    ListNode dummy;
    ListNode* cur = &dummy;
    for (const auto& v : arr) {
        cur->next = new ListNode(v.get<int>());
        cur = cur->next;
    }
    return dummy.next;
}

inline json listToJson(ListNode* head) {
    json out = json::array();
    while (head) {
        out.push_back(head->val);
        head = head->next;
    }
    return out;
}
// === End prelude ===
`
