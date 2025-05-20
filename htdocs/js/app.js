/*
 * 横浜国立大学在学生向けオンライン掲示板
 *
 * postStatus:
 *      00 : フラグなし、未読 = 0
 *      01 : フラグなし、既読 = 1
 *      10 : フラグあり、未読 = 2
 *      11 : フラグあり、既読 = 3
 */
import {
    createApp,
    ref,
    onMounted,
// } from "./lib/vue.esm-browser.prod.js";
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import "./lib/dayjs.min.js";
import "./lib/axios.min.js"

// 1. Define route components.
// These can be imported from other files
const kojiList = { template: '<div>古事類苑LOD</div>' }
const kojiDetail = { template: '<div>古事</div>' }

// 2. Define some routes
// Each route should map to a component.
// We'll talk about nested routes later.
const routes = [
    { path: '/',
        component: kojiList,
        meta:{title:"古事類苑LOD"},
    },
    { path: '/detail/:bbsPostId', component: kojiDetail },
]

export default {
    computed: {
        bbsPostId() {
            return this.$route.params.bbsPost;
        },
    },
    methods: {
        goToDashboard() {
            if (isAuthenticated) {
            this.$router.push('/dashboard')
            } else {
            this.$router.push('/login')
            }
        },
        // 日付フォーマットを変更
        dateFormat: function (postDate) {
            const date = new Date(postDate)
            const year = date.getFullYear()
            const month = date.getMonth() + 1
            const day = date.getDate()
            return year + '/' + month + '/' + day
        },
    },
}

// URLの解析
let url = location.href;
let idx = url.indexOf("/");
let params = [];
if(idx != -1) {
    params = getParam();
}
// 検索クエリの取得
let query_params = getQueryStr();

let theme_query = `
OPTIONAL {
        ?s dcat:theme ?theme .
    }
`;
if ( "theme" in query_params ){
theme_query = `
    ?s dcat:theme "${query_params["theme"]}".
    BIND("${query_params["theme"]}" AS ?theme)
`
}

let type_query = `
OPTIONAL {
        ?s dct:type ?type .
    }
`;
if ( "type" in query_params ){
type_query = `
    ?s dct:type "${query_params["type"]}" .
    BIND("${query_params["type"]}" AS ?type)
`;
}

if( query_params.length > 0 ){
    // 検索モード
}

const endpoint = 'http://kingman.lodac.nii.ac.jp/sparql';
// const endpoint = 'http://localhost:8891/sparql';
const base_query = `?default-graph-uri=
&format=application%2Fsparql-results%2Bjson
&timeout=0
&signal_void=on
&query=
`.replace(/\r?\n/g, '');

let bu_all_query = `
SELECT DISTINCT * WHERE {
    <http://kojiruien.kgraph.jp/collection/古事類苑> dcterms:hasPart ?item .
    ?item rdfs:label ?item_name .
    OPTIONAL {
        SELECT ?item (group_concat(distinct ?desc ; separator = ", ") AS ?desc)
            WHERE {
                OPTIONAL {
                    ?item dc:description ?desc .
                }
            }
        GROUP BY ?item
    }
    BIND(CONCAT(?item_name) as ?link_name)
} GROUP BY ?item ORDER BY ?item
`.replace(/\r?\n/g, '');

let mon_all_query = `
SELECT DISTINCT * WHERE {
    <http://kojiruien.kgraph.jp/collection/${params[0]}> dcterms:hasPart ?item ;
        rdfs:label ?bu_name .
    ?item rdfs:label ?item_name .
    OPTIONAL {
        SELECT ?item (group_concat(distinct ?desc ; separator = ", ") AS ?desc)
            WHERE {
                OPTIONAL {
                    ?item dc:description ?desc .
                }
            }
        GROUP BY ?item
    }
    BIND(CONCAT(?bu_name,"/",?item_name) as ?link_name)
} GROUP BY ?item ORDER BY ?item
`.replace(/\r?\n/g, '');

let kou_all_query = `
SELECT DISTINCT * WHERE {
    <http://kojiruien.kgraph.jp/collection/${params[0]}> rdfs:label ?bu_name .
    <http://kojiruien.kgraph.jp/collection/${params[0]}/${params[1]}> skos:narrower ?item ;
        rdfs:label ?mon_name .
    ?item rdfs:label ?item_name .
    OPTIONAL {
        SELECT ?item (group_concat(distinct ?desc ; separator = ", ") AS ?desc)
            WHERE {
                OPTIONAL { ?item dc:description ?desc . }
            }
        GROUP BY ?item
    }
    OPTIONAL {
        ?item dcterms:references ?ref .
        OPTIONAL {
            ?ref schema:text ?text .
        }
    }
    OPTIONAL {
        ?item skos:narrower ?moku .
    }
    BIND(CONCAT(?bu_name,"/",?mon_name,"/",?item_name) as ?link_name)
} GROUP BY ?item ORDER BY ?item
`.replace(/\r?\n/g, '');

let moku_all_query = `
SELECT DISTINCT * WHERE {
    <http://kojiruien.kgraph.jp/collection/${params[0]}> rdfs:label ?bu_name .
    <http://kojiruien.kgraph.jp/collection/${params[0]}/${params[1]}> skos:narrower ?mon_name .
    <http://kojiruien.kgraph.jp/collection/${params[0]}/${params[1]}/${params[2]}> skos:narrower ?item ;
        rdfs:label ?kou_name .
    ?item rdfs:label ?item_name .
    OPTIONAL {
        SELECT ?item (group_concat(distinct ?desc ; separator = ", ") AS ?desc)
            WHERE {
                OPTIONAL { ?item dc:description ?desc . }
            }
        GROUP BY ?item
    }
    OPTIONAL {
        ?item dcterms:references ?ref .
        OPTIONAL {
            ?ref schema:text ?text .
        }
    }
    BIND(CONCAT(?bu_name,"/",?mon_name,"/",?kou_name,"/",?item_name) as ?link_name)
} GROUP BY ?item ORDER BY ?item
`.replace(/\r?\n/g, '');

let ref_kou_all_query = `
SELECT DISTINCT * WHERE {
    <http://kojiruien.kgraph.jp/collection/古事類苑> dcterms:hasPart ?bu .
    ?bu rdfs:label ?bu_name ;
        dcterms:hasPart ?mon .
    ?mon rdfs:label ?mon_name ;
         skos:narrower ?item .
    ?item rdfs:label ?item_name .
    OPTIONAL {
        ?item dcterms:references ?ref .
        ?ref schema:text ?text .
    }
    FILTER( CONTAINS( str(?ref), "${params[1]}") )
    BIND(CONCAT(?bu_name,"/",?mon_name,"/",?item_name) as ?link_name)
} ORDER BY ?bu
`.replace(/\r?\n/g, '');

let mon_query = `
prefix xsd: <http://www.w3.org/2001/XMLSchema#>
prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
prefix owl: <http://www.w3.org/2002/07/owl#>
prefix skos: <http://www.w3.org/2004/02/skos/core#>
prefix schema: <http://schema.org/>
prefix foaf: <http://xmlns.com/foaf/0.1/>
prefix dct: <http://purl.org/dc/terms/>

SELECT DISTINCT * WHERE {
    ?s a estat:統計調査;
        dct:identifier ?dataset_id ;
        dct:accrualPeriodicity ?cycle ;
        foaf:homepage ?homepage ;
        disco:universe ?universe ;
        dct:title ?title .
    ${theme_query}
    ${type_query}
    OPTIONAL {
            ?s dct:temporal ?temporal .
    }
     OPTIONAL {
            ?s dct:spatial ?spatial .
    }
}
`.replace(/\r?\n/g, '');

let query = endpoint + base_query + encodeURIComponent(bu_all_query);

if( params.length == 0 ){
    const catBuTable = createApp({
        data() {
            return {
                searchKeywords: [],
            }
        },
        setup() {
            let filteredPosts = ref(null);
            let filtered = ref(null);
            const articles = ref(null);
            const queries = ref(null);
            let sparql_query = endpoint + base_query + encodeURIComponent(bu_all_query);
            console.log(sparql_query)
            const sortArticle = async () => {
                let result;
                result = await fetch( sparql_query );
                result = await result.json();
                console.log(result.results.bindings);
                filteredPosts.value = result.results.bindings;
                articles.value = result.results.bindings;
                queries.value = query_params;
            }
            onMounted( async () => {
                await sortArticle();
            })
            return {
                articles, queries, filteredPosts, filtered
            }
        },
        mounted() {
            //this.checkAllStatus();
        },
        methods: { // このapp内で使用する関数定義
            // 日付フォーマットを変更
            dateFormat: function (postDate) {
                const date = new Date(postDate)
                const year = date.getFullYear()
                const month = date.getMonth() + 1
                const day = date.getDate()
                return year + '/' + month + '/' + day
            },
            resetSearch: function() {
                this.selectedCategory = [];
                this.selectedFaculty = [];
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');
                if( (savedFaculty) && (!this.hasAll) ){
                    this.selectedFaculty = savedFaculty;
                }
                this.saveFaculty = [];
                this.searchKeywords = [];
                this.filteredPosts = this.articles;
            },
            filterBbsPosts: function(){
                this.filtered = this.articles;
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');

                if ( (savedFaculty) && (savedFaculty != this.selectedFaculty) ){ // 新規にカテゴリを指定して取得
                    let _category_id = this.categories[this.selectedFaculty];
                    axios.get( api_postList + '?per_page=100&categpries=' + _category_id ).then(result => {
                        this.articles = result.data;
                        this.filtered = this.articles;
                        this.hasAll = true;
                    }).catch((error) => alert('正しくjsonデータが読み込まれていません。error:' + error
                    )).finally( () => {
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // OR検索
                        if ( (this.selectedCategory) && (this.selectedCategory.length > 0) ) {
                            this.filtered = this.filtered.filter((item) => {
                                for (let i = 0; i < this.selectedCategory.length; i++) {
                                    if (item.acf['カテゴリ'].includes(this.selectedCategory[i])) {
                                        return true;
                                    }
                                }
                                return false;
                            });
                        }

                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                        this.saveFaculty = [];
                        this.filteredPosts = this.filtered;
                        return this.filteredPosts;
                    });
                } else {
                    if ( (this.selectedFaculty) && (this.selectedFaculty.length > 0) ) { // 全データを持っている場合
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                    }

                    // LocalStorageに保存
                    this.saveFaculty = [];
                    this.filteredPosts = this.filtered;
                    return this.filteredPosts;
                }
            },
        },
        computed() { // ブラウザ側で変化があったら実行
            // this.checkAllStatus();
        },
    })
    catBuTable.mount("#bbsPostsList");
}

/*
 * 門の取り出し
 *
 */
else if ( params.length == 1) {
    const catMonTable = createApp({
        data() {
            return {
                searchKeywords: [],
            }
        },
        setup() {
            let filteredPosts = ref(null);
            let filtered = ref(null);
            const articles = ref(null);
            const queries = ref(null);
            let sparql_query = endpoint + base_query + encodeURIComponent(mon_all_query);
            console.log(params[0] + "の取得");
            console.log(sparql_query)
            const sortArticle = async () => {
                let result;
                result = await fetch( sparql_query );
                result = await result.json();
                console.log(result.results.bindings);
                filteredPosts.value = result.results.bindings;
                articles.value = result.results.bindings;
                queries.value = params;
            }
            onMounted( async () => {
                await sortArticle();
            })
            return {
                articles, queries, filteredPosts, filtered
            }
        },
        mounted() {
            //this.checkAllStatus();
        },
        methods: { // このapp内で使用する関数定義
            // 日付フォーマットを変更
            dateFormat: function (postDate) {
                const date = new Date(postDate)
                const year = date.getFullYear()
                const month = date.getMonth() + 1
                const day = date.getDate()
                return year + '/' + month + '/' + day
            },
            resetSearch: function() {
                this.selectedCategory = [];
                this.selectedFaculty = [];
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');
                if( (savedFaculty) && (!this.hasAll) ){
                    this.selectedFaculty = savedFaculty;
                }
                this.saveFaculty = [];
                this.searchKeywords = [];
                this.filteredPosts = this.articles;
            },
            filterBbsPosts: function(){
                this.filtered = this.articles;
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');

                if ( (savedFaculty) && (savedFaculty != this.selectedFaculty) ){ // 新規にカテゴリを指定して取得
                    let _category_id = this.categories[this.selectedFaculty];
                    axios.get( api_postList + '?per_page=100&categpries=' + _category_id ).then(result => {
                        this.articles = result.data;
                        this.filtered = this.articles;
                        this.hasAll = true;
                    }).catch((error) => alert('正しくjsonデータが読み込まれていません。error:' + error
                    )).finally( () => {
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // OR検索
                        if ( (this.selectedCategory) && (this.selectedCategory.length > 0) ) {
                            this.filtered = this.filtered.filter((item) => {
                                for (let i = 0; i < this.selectedCategory.length; i++) {
                                    if (item.acf['カテゴリ'].includes(this.selectedCategory[i])) {
                                        return true;
                                    }
                                }
                                return false;
                            });
                        }

                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                        this.saveFaculty = [];
                        this.filteredPosts = this.filtered;
                        return this.filteredPosts;
                    });
                } else {
                    if ( (this.selectedFaculty) && (this.selectedFaculty.length > 0) ) { // 全データを持っている場合
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                    }

                    // LocalStorageに保存
                    this.saveFaculty = [];
                    this.filteredPosts = this.filtered;
                    return this.filteredPosts;
                }
            },
        },
        computed() { // ブラウザ側で変化があったら実行
            // this.checkAllStatus();
        },
    })
    catMonTable.mount("#bbsPostsList");
}

/*
 * 項の取り出し
 *
 */
else if ( params.length == 2) {
    const catMonTable = createApp({
        data() {
            return {
                searchKeywords: [],
            }
        },
        setup() {
            let filteredPosts = ref(null);
            let filtered = ref(null);
            const articles = ref(null);
            const queries = ref(null);
            let sparql_query = endpoint + base_query + encodeURIComponent(kou_all_query);
            if( params[0] == "reference" ){
                sparql_query = endpoint + base_query + encodeURIComponent(ref_kou_all_query);
            }
            console.log(params[0] + " 部 / " + params[1] + " 門 の取得");
            console.log(sparql_query)
            const sortArticle = async () => {
                let result;
                result = await fetch( sparql_query );
                result = await result.json();
                console.log(result.results.bindings);
                filteredPosts.value = result.results.bindings;
                articles.value = result.results.bindings;
                queries.value = params;
            }
            onMounted( async () => {
                await sortArticle();
            })
            return {
                articles, queries, filteredPosts, filtered
            }
        },
        mounted() {
            //this.checkAllStatus();
        },
        methods: { // このapp内で使用する関数定義
            // 日付フォーマットを変更
            dateFormat: function (postDate) {
                const date = new Date(postDate)
                const year = date.getFullYear()
                const month = date.getMonth() + 1
                const day = date.getDate()
                return year + '/' + month + '/' + day
            },
            resetSearch: function() {
                this.selectedCategory = [];
                this.selectedFaculty = [];
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');
                if( (savedFaculty) && (!this.hasAll) ){
                    this.selectedFaculty = savedFaculty;
                }
                this.saveFaculty = [];
                this.searchKeywords = [];
                this.filteredPosts = this.articles;
            },
            filterBbsPosts: function(){
                this.filtered = this.articles;
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');

                if ( (savedFaculty) && (savedFaculty != this.selectedFaculty) ){ // 新規にカテゴリを指定して取得
                    let _category_id = this.categories[this.selectedFaculty];
                    axios.get( api_postList + '?per_page=100&categpries=' + _category_id ).then(result => {
                        this.articles = result.data;
                        this.filtered = this.articles;
                        this.hasAll = true;
                    }).catch((error) => alert('正しくjsonデータが読み込まれていません。error:' + error
                    )).finally( () => {
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // OR検索
                        if ( (this.selectedCategory) && (this.selectedCategory.length > 0) ) {
                            this.filtered = this.filtered.filter((item) => {
                                for (let i = 0; i < this.selectedCategory.length; i++) {
                                    if (item.acf['カテゴリ'].includes(this.selectedCategory[i])) {
                                        return true;
                                    }
                                }
                                return false;
                            });
                        }

                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                        this.saveFaculty = [];
                        this.filteredPosts = this.filtered;
                        return this.filteredPosts;
                    });
                } else {
                    if ( (this.selectedFaculty) && (this.selectedFaculty.length > 0) ) { // 全データを持っている場合
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                    }

                    // LocalStorageに保存
                    this.saveFaculty = [];
                    this.filteredPosts = this.filtered;
                    return this.filteredPosts;
                }
            },
        },
        computed() { // ブラウザ側で変化があったら実行
            // this.checkAllStatus();
        },
    })
    catMonTable.mount("#bbsPostsList");
}

/*
 * 目の取り出し
 *
 */
else if ( params.length == 3) {
    const catMonTable = createApp({
        data() {
            return {
                searchKeywords: [],
            }
        },
        setup() {
            let filteredPosts = ref(null);
            let filtered = ref(null);
            const articles = ref(null);
            const queries = ref(null);
            let sparql_query = endpoint + base_query + encodeURIComponent(moku_all_query);
            console.log(params[0] + " 部 / " + params[1] + " 門 / " + params[2] + " 項 の取得");
            console.log(sparql_query)
            const sortArticle = async () => {
                let result;
                result = await fetch( sparql_query );
                result = await result.json();
                console.log(result.results.bindings);
                filteredPosts.value = result.results.bindings;
                articles.value = result.results.bindings;
                queries.value = params;
            }
            onMounted( async () => {
                await sortArticle();
            })
            return {
                articles, queries, filteredPosts, filtered
            }
        },
        mounted() {
            //this.checkAllStatus();
        },
        methods: { // このapp内で使用する関数定義
            // 日付フォーマットを変更
            dateFormat: function (postDate) {
                const date = new Date(postDate)
                const year = date.getFullYear()
                const month = date.getMonth() + 1
                const day = date.getDate()
                return year + '/' + month + '/' + day
            },
            resetSearch: function() {
                this.selectedCategory = [];
                this.selectedFaculty = [];
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');
                if( (savedFaculty) && (!this.hasAll) ){
                    this.selectedFaculty = savedFaculty;
                }
                this.saveFaculty = [];
                this.searchKeywords = [];
                this.filteredPosts = this.articles;
            },
            filterBbsPosts: function(){
                this.filtered = this.articles;
                let savedFaculty;
                savedFaculty = localStorage.getItem('savedFaculty');

                if ( (savedFaculty) && (savedFaculty != this.selectedFaculty) ){ // 新規にカテゴリを指定して取得
                    let _category_id = this.categories[this.selectedFaculty];
                    axios.get( api_postList + '?per_page=100&categpries=' + _category_id ).then(result => {
                        this.articles = result.data;
                        this.filtered = this.articles;
                        this.hasAll = true;
                    }).catch((error) => alert('正しくjsonデータが読み込まれていません。error:' + error
                    )).finally( () => {
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // OR検索
                        if ( (this.selectedCategory) && (this.selectedCategory.length > 0) ) {
                            this.filtered = this.filtered.filter((item) => {
                                for (let i = 0; i < this.selectedCategory.length; i++) {
                                    if (item.acf['カテゴリ'].includes(this.selectedCategory[i])) {
                                        return true;
                                    }
                                }
                                return false;
                            });
                        }

                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                        this.saveFaculty = [];
                        this.filteredPosts = this.filtered;
                        return this.filteredPosts;
                    });
                } else {
                    if ( (this.selectedFaculty) && (this.selectedFaculty.length > 0) ) { // 全データを持っている場合
                        let _category_id = this.categories[this.selectedFaculty];
                        this.filtered = this.filtered.filter((item) => {
                            if (item.categories.includes(_category_id)) {
                                return true;
                            }
                            return false;
                        });
                        // LocalStorageに保存
                        if(this.saveFaculty == 'saved'){
                            this.savedFaculty = this.selectedFaculty;
                            localStorage.setItem('savedFaculty', this.selectedFaculty);
                        }
                    }

                    // LocalStorageに保存
                    this.saveFaculty = [];
                    this.filteredPosts = this.filtered;
                    return this.filteredPosts;
                }
            },
        },
        computed() { // ブラウザ側で変化があったら実行
            // this.checkAllStatus();
        },
    })
    catMonTable.mount("#bbsPostsList");
}

const postTable = createApp({
    data() {
        let bbsPostId = params['bbsPostId'];
        let savedPostStatus = {};
        savedPostStatus = JSON.parse(localStorage.getItem('savedPostStatus'));
        if(savedPostStatus === null){
            savedPostStatus = {};
            savedPostStatus[bbsPostId] = 0;
        }
        return{
            bbsPostId,
            savedPostStatus,
        }
    },
    setup() {
        const authors = ref(null);
        const setAuthors = async () => {
            let result;
            let _author = [];
            result = await fetch( api_userList );
            result = await result.json();
            result.forEach((obj) => {
                _author[obj.id] = obj.name;
            })
            authors.value = _author;
        }
        const categories = ref(null);
        const setCategories = async () => {
            let result;
            let _category = [];
            result = await fetch( api_categoryList );
            result = await result.json();
            result.forEach((obj) => {
                _category[obj.id] = obj.name;
            })
            categories.value = _category;
        }
        api_postList += '/' + params['bbsPostId'] + '?acf_format=standard';
        const articles = ref(null);
        const queries = ref(null);
        const sortArticle = async () => {
            let result;
            result = await fetch( api_postList );
            result = await result.json();
            articles.value = [result];
            queries.value = params;
        }
        onMounted( async () => {
            await setAuthors();
            await setCategories();
            await sortArticle();
        })
        return {
            authors, articles, queries, categories
        }
    },
    mounted() {
        this.setPostRead(true);
    },
    computed(){
        this.setPostFlagged(setFlag);
    },
    methods: {
        // 日付フォーマットを変更
        dateFormat: function (postDate) {
            const date = new Date(postDate)
            const year = date.getFullYear()
            const month = date.getMonth() + 1
            const day = date.getDate()
            return year + '/' + month + '/' + day
        },
        getSrcUrl: function (orgURL) {
            let pattern = /<ifaame src=\"\([^\"]*\"\).* title=\"\(^\"]*\)\"><\/iframe>/ ;
            const match = orgURL.match(pattern)
            return match;
        },
        setPostRead: function (setRead) {
            if(this.savedPostStatus[this.bbsPostId] != null){
                if(this.savedPostStatus[this.bbsPostId] == 0){
                    this.savedPostStatus[this.bbsPostId] = 1;
                } else if(this.savedPostStatus[this.bbsPostId] == 2){
                    this.savedPostStatus[this.bbsPostId] = 3;
                }
            } else{
                this.savedPostStatus[this.bbsPostId] = 1;
            }
            this.save2LocalStorage();
        },
        setPostFlagged: function (setFlag) {
            if (setFlag) {
                this.savedPostStatus[this.bbsPostId] = 3;
            } else{
                this.savedPostStatus[this.bbsPostId] = 1;
            }
            this.save2LocalStorage();
        },
        save2LocalStorage: function() {
            localStorage.setItem('savedPostStatus', JSON.stringify(this.savedPostStatus));
        }
    }
})
postTable.mount("#bbsPost");


/*
 * Function(s)
 * 
 */
function getQueryStr() {
    let _url = location.href;
    const url   = new URL(_url.replace(/#/g,''));
    let params = url.searchParams;
    let paramsArray = [];
        params.forEach(function(value,key){
            paramsArray.push(key);
            paramsArray[key] = value;
        });
    var values = [];
    if (paramsArray["theme"])　{
        values["theme"] = paramsArray["theme"];
    }
    if (paramsArray["type"])　{
        values["type"] = paramsArray["type"];
    }
    return values;
}

// URLの構造から部、門、項の取り出し
function getParam() {
    let url   = location.href;
    let params = url.split("/");
    let values = [];
    params.splice(0,4);
    params.forEach(_value => {
        values.push(decodeURIComponent(_value));
    });
    return values;
}
