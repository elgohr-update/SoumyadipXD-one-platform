import { SearchMap } from "./schema";
import { TemplateHelper } from "./helpers";
import { SearchIndexHelper } from "../search-config/helpers";
import * as _ from "lodash";

export class SearchMapCron {
    public async searchMapTrigger () {
        let mappedList: any = [];
        const searchMapList = await SearchMap.find();
        const apps = await TemplateHelper.listApps();
        await searchMapList.map( async ( searchMap: any, configIndex: any ) => {
            const apiResponse = await TemplateHelper.fetchApi( searchMap.apiConfig.authorizationHeader, searchMap.apiConfig.apiUrl, searchMap.apiConfig.query, searchMap.apiConfig.param || null, searchMap.apiConfig.mode );
            await apiResponse[Object.keys(apiResponse)[0]].map(async (data: any) => {
                let mappedField: any = {};
                let mappedTitle = '';
                let mappedUrl = '';
                await searchMap.fields.map(async (field: any, index: any) => {
                    mappedField[field.to] = await TemplateHelper.objectStringMapper(data, field.from);
                    if ( searchMap.fields.length === index + 1 ) {
                        mappedField.tags = apps.filter( ( app: any ) => app.id === searchMap.appId )[ 0 ].name;;
                        mappedField.contentType = apps.filter( ( app: any ) => app.id === searchMap.appId )[0].name;
                        mappedField.icon = searchMap.preferences.iconUrl;
                        mappedTitle = searchMap.preferences.titleTemplate;
                        searchMap.preferences.titleParams.map( ( titleParam: any ) => mappedTitle = mappedTitle.replace( titleParam, data[ titleParam ] ));
                        mappedField.title = mappedTitle;
                        mappedUrl = searchMap.preferences.urlTemplate;
                        searchMap.preferences.urlParams.map( ( urlParam: any, index: number ) => {
                            if ( index === 0 && urlParam === 'path' && data[ urlParam ].startsWith('/') ) {
                                data[ urlParam ] = data[ urlParam ].slice(1);
                            }
                            return mappedUrl = mappedUrl.replace( urlParam, data[ urlParam ] )
                        } );
                        mappedField.uri = process.env.CLIENT_URL + mappedUrl;
                        mappedList.push(mappedField);
                    }
                });
            } );
            const uniqueItems = _.uniqBy( mappedList, 'id' );
            const chunks = _.chunk( uniqueItems, 100 );

            const searchInputMap = chunks.map( async ( chunk: any, index: any ) => {
                const searchInput = {
                    dataSource: process.env.SEARCH_DATA_SOURCE,
                    documents: chunk
                };
                return SearchIndexHelper.index( searchInput, 3);
            } );

            const response = await Promise.all( searchInputMap );
            console.info('Index batch responses: ', response);
        } );
    }
}
