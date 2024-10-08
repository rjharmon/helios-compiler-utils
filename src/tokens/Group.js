import { None, isNone, isSome } from "@helios-lang/type-utils"
import { SourceWriter } from "./SourceWriter.js"
import { SymbolToken } from "./SymbolToken.js"
import { TokenSite } from "./TokenSite.js"

/**
 * @typedef {import("../errors/index.js").Site} Site
 * @typedef {import("./Token.js").Token} Token
 */

/**
 * Group token can '(...)', '[...]' or '{...}' and can contain comma separated fields.
 * @template {Token[] | {tokens: Token[]}} [F=Token[]] - each field be either a list of tokens or a TokenReader
 * @implements {Token}
 */
export class Group {
    /**
     * "(", "[" or "{"
     * @readonly
     * @type {string}
     */
    kind

    /**
     * @readonly
     * @type {F[]}
     */
    fields

    /**
     * @readonly
     * @type {SymbolToken[]}
     */
    separators

    /**
     * TokenSite instead of Token because we need position information of the closing symbol for accurate formatting purposes
     * @readonly
     * @type {TokenSite}
     */
    site

    /**
     * @readonly
     * @type {string | null}
     */
    error

    /**
     * @param {string} kind - "(", "[" or "{"
     * @param {F[]} fields
     * @param {SymbolToken[]} separators - useful for more accurate errors
     * @param {TokenSite} site
     */
    constructor(kind, fields, separators, site = TokenSite.dummy()) {
        const expectCount = Math.max(fields.length - 1, 0)
        this.error = null
        if (separators.length > expectCount) {
            const separatorType = separators[0].value
            this.error = `'${kind}' group: excess '${separatorType}' - expected ${expectCount}, got ${separators.length}`
        } else if (separators.length != expectCount) {
            throw new Error(`expected ${expectCount}, got ${separators.length}`)
        }

        this.kind = kind
        this.fields = fields // list of lists of tokens
        this.separators = separators
        this.site = site
    }

    /**
     * @param {any} token
     * @returns {Option<Group>}
     */
    static from(token) {
        return token instanceof Group ? token : None
    }

    /**
     * @param {string} kind
     * @returns {boolean}
     */
    isKind(kind) {
        return this.kind == kind
    }

    /**
     * @param {Option<string>} kind
     * @param {Option<number>} nFields
     * @returns {boolean}
     */
    isGroup(kind = None, nFields = None) {
        const nFieldsOk = isNone(nFields) || nFields == this.fields.length

        if (isSome(kind)) {
            return this.kind == kind && nFieldsOk
        } else {
            return nFieldsOk
        }
    }

    /**
     * @param {boolean} preserveWhitespace
     * @returns {string}
     */
    toString(preserveWhitespace = false) {
        if (preserveWhitespace) {
            const w = new SourceWriter({
                line: this.site.line,
                column: this.site.column
            })

            w.writeToken(new SymbolToken(this.kind, this.site))

            for (let i = 0; i < this.fields.length; i++) {
                const f = this.fields[i]

                if (Array.isArray(f)) {
                    f.forEach((f) => w.writeToken(f))
                } else {
                    f.tokens.forEach((f) => w.writeToken(f))
                }

                if (i < this.fields.length - 1) {
                    w.writeToken(this.separators[i])
                }
            }

            w.writeToken(
                new SymbolToken(
                    Group.otherSymbol(this.kind),
                    new TokenSite({
                        file: this.site.file,
                        startLine: this.site.endLine,
                        startColumn: this.site.endColumn
                    })
                )
            )
            return w.finalize()
        } else {
            let s = this.kind

            const parts = []

            for (let f of this.fields) {
                if (Array.isArray(f)) {
                    parts.push(f.map((t) => t.toString(false)).join(" "))
                } else {
                    parts.push(f.tokens.map((t) => t.toString(false)).join(" "))
                }
            }

            s += parts.join(", ") + Group.otherSymbol(this.kind)

            return s
        }
    }

    /**
     * @param {Token} t
     * @returns {t is SymbolToken}
     */
    static isOpenSymbol(t) {
        if (SymbolToken.isSymbol(t)) {
            return t.matches(["{", "[", "("])
        } else {
            return false
        }
    }

    /**
     * @param {Token} t
     * @returns {t is SymbolToken}
     */
    static isCloseSymbol(t) {
        if (SymbolToken.isSymbol(t)) {
            return t.matches(["}", "]", ")"])
        } else {
            return false
        }
    }

    /**
     * Returns the corresponding closing bracket, parenthesis or brace.
     * Throws an error if not a group symbol.
     * @example
     * Group.matchSymbol("(") == ")"
     * @param {string | SymbolToken} t
     * @returns {string}
     */
    static otherSymbol(t) {
        if (SymbolToken.isSymbol(t)) {
            t = t.value
        }

        if (t == "{") {
            return "}"
        } else if (t == "[") {
            return "]"
        } else if (t == "(") {
            return ")"
        } else if (t == "}") {
            return "{"
        } else if (t == "]") {
            return "["
        } else if (t == ")") {
            return "("
        } else {
            throw new Error("not a group symbol")
        }
    }

    /**
     * Finds the index of first Group(type) in list of tokens
     * Returns -1 if none found.
     * @param {Token[]} ts
     * @param {string} kind
     * @returns {number}
     */
    static find(ts, kind) {
        return ts.findIndex((item) => Group.from(item)?.isKind(kind))
    }
}
