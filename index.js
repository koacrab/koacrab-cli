#!/usr/bin/env node

const inquirer = require('inquirer');
const { mkdirp } = require('mkdirp');
const fs = require('fs');
const path = require('path');

async function generateFiles() {
    // 提示用户输入表结构
    const { tableStructure } = await inquirer.prompt([
        {
            type: 'editor',
            name: 'tableStructure',
            message: '请输入表结构：',
        },
    ]);

    // 解析表名
    const tableNameMatch = tableStructure.match(/CREATE TABLE `([^`]+)`/);
    if (!tableNameMatch) {
        console.error('无法解析表名，请检查输入的表结构。');
        return;
    }

    const tableName = tableNameMatch[1];
    if (tableName.indexOf('_') === -1) {
        console.error('表名必须包含下划线，请检查输入的表结构');
        return;
    }

    const tableNameParts = tableName.match(/^([^_]+)_(.*)$/);
    const folderName = tableNameParts[1];
    const fileName = tableNameParts[2];
    const { camelCase: tableNameCase, pascalCase: tableNameGigCase } = convertToCamelCase(tableName);
    const { camelCase: fileNameCamel, pascalCase: fileNameBigCamel } = convertToCamelCase(fileName);


    // 解析字段
    const fieldMatches = tableStructure.match(/`([^`]+)`/g);
    const fields = fieldMatches.map(match => match.replace(/`/g, ''));

    // 创建文件夹
    const controllersPath = path.join(process.cwd(), 'controllers', folderName);
    const servicesPath = path.join(process.cwd(), 'services', folderName);
    const modelsPath = path.join(process.cwd(), 'models');
    await mkdirp(controllersPath);
    await mkdirp(servicesPath);
    await mkdirp(modelsPath);

    // 生成 models 文件
    const modelFilePath = path.join(modelsPath, tableNameCase + '.js');
    if (!fs.existsSync(modelFilePath)) {
        const modelContent = generateModelContent(tableName, tableNameGigCase);
        fs.writeFileSync(modelFilePath, modelContent);
    }

    // 生成 controllers 文件
    const controllerFilePath = path.join(controllersPath, fileNameCamel + '.js');
    if (!fs.existsSync(controllerFilePath)) {
        const controllerContent = generateControllerContent(folderName, fileNameCamel, fileNameBigCamel);
        fs.writeFileSync(controllerFilePath, controllerContent);
    }

    // 生成 services 文件
    const serviceFilePath = path.join(servicesPath, fileNameCamel + '.js');
    if (!fs.existsSync(serviceFilePath)) {
        const serviceContent = generateServiceContent(tableNameCase, fileNameBigCamel, fields);
        fs.writeFileSync(serviceFilePath, serviceContent);
    }

    console.log('文件生成成功！');
}

function convertToCamelCase(str = '') {
    const parts = str.split('_');
    return {
        camelCase: parts.map((p, i) => i ? p[0].toUpperCase() + p.slice(1) : p).join(''),
        pascalCase: parts.map(p => p[0].toUpperCase() + p.slice(1)).join('')
    };
};

function generateModelContent(tableName, tableNameGigCase) {
    return `
module.exports = class ${tableNameGigCase} {
    constructor() {
        this.table = '${tableName}';
        this.db = koacrab.mysql;
    }

    async list(info = {}) {
        let { field = [], where = {}, order = 'add_time desc, id desc', limit = [0, 10], pageNum = '', pageSize = '' } = info;

        let { error, result } = await this.db.table(this.table)
            .field(field) 
            .where(where) 
            .order(order) 
            .page(pageNum, pageSize) 
            .limit(limit) 
            .select() 
            .execSql(); 

        return result;
    }

    async find(info = {}) {
        let { field = [], where = {}, order = '' } = info;

        let { error, result } = await this.db.table(this.table)
            .field(field) 
            .where(where) 
            .order(order) 
            .execSql(); 

        return result;
    }

    async count(info = {}) {
        let { where = {} } = info;

        let { result } = await this.db.table(this.table)
            .where(where)
            .count()
            .find()
            .execSql();

        return result;
    }

    async insert(insertData) {
        let { result } = await this.db.table(this.table)
            .data(insertData)
            .insert()
            .execSql();

        return result.insertId || ''
    }

    async delete(info = {}) {
        let { where = {} } = info;
        await this.db.table(this.table)
            .where(where)
            .delete()
            .execSql()
    }

    async update(info = {}) {
        let { result } = await this.db.table(this.table)
            .data(info.data)
            .where(info.where)
            .update()
            .execSql()

        return result;
    }
}
`;
}

function generateControllerContent(folderName, fileNameCamel, fileNameBigCamel) {
    return `
module.exports = class ${fileNameBigCamel} {
    constructor() {
        
    }

    async list() {
        let fields = this.request.fields;
        let services = this.services['${folderName}/${fileNameCamel}'];

        let result = await services.list(fields);
        this.renderText(result);
    }

    async info() {
        let query = this.request.query;
        let services = this.services['${folderName}/${fileNameCamel}'];

        let result = await services.info(query);
        this.renderText(result);
    }

    async del() {
        let query = this.request.query;
        let services = this.services['${folderName}/${fileNameCamel}'];

        let result = await services.del(query);
        this.renderText(result);
    }

    async add() {
        let fields = this.request.fields;
        let services = this.services['${folderName}/${fileNameCamel}'];

        let result = await services.add(fields);
        this.renderText(result);
    }
}
`;
}

function generateServiceContent(tableNameCase, fileNameBigCamel, fields) {
    const filteredFields = fields.filter(field =>!['id', 'delete_time', 'update_time'].includes(field)); // 过滤掉id、delete_time、update_time字段
    return `
const tools = require('@tools/tools.js');
module.exports = class ${fileNameBigCamel} {
    constructor() {}

    // 列表
    async list(info = {}) {
        let reason = '', result = [], error = 0;
        let lists = await koacrab.models.${tableNameCase}.list(info);
        let total = await koacrab.models.${tableNameCase}.count(info);
        return {
            error: error,
            reason: reason,
            result: {
                lists,
                total
            }
        }
    }

    // 添加
    async add(info = {}) {
        let error = 0;
        let reason = '', result = {};
        let time = new Date().getTime();
        let { id = '', token = '' } = info;
        id = tools.encryptAndDecrypt(1, 3, id);

        let userInfo = await koacrab.models.user.find({
            field: ['id', 'nickname', 'alias_name', 'status', 'o.openid'],
            where: { token: info.token, service_id: info.serviceId || 0 }
        });

        if (!userInfo.id) {
            error = 100;
            reason = '请先登录!';
        } else {
            if (id) {
                let updateData = {
                    update_time: time
                };

                // 根据表结构字段来更新数据
                ${filteredFields.map(field => `if (info.hasOwnProperty('${field}')) {
                    updateData['${field}'] = info['${field}'] || '';
                }`).join('\n')}

                await koacrab.models.${tableNameCase}.update({
                    data: updateData,
                    where: { id }
                });
            } else {
                let insertData = {
                    user_id: userInfo.id,
                    status: 0,
                    add_time: time,
                    update_time: time
                };

                // 根据表结构字段来插入数据
                ${filteredFields.map(field => `if (info.hasOwnProperty('${field}')) {
                    insertData['${field}'] = info['${field}'] || '';
                }`).join('\n')}

                await koacrab.models.${tableNameCase}.insert(insertData);
                reason = '添加成功！';
            }
        }

        return {
            error: error,
            reason: reason,
            result: result || {}
        }
    }

    // 详情
    async info(info = {}) {
        let reason = '', error = 0, result = {};
        let { id = '', token = '' } = info;
        id = tools.encryptAndDecrypt(1, 3, id);

        if (id) {
            let activityInfo = await koacrab.models.${tableNameCase}.find({
                where: { id }
            });

            if (activityInfo['id']) {
                result = activityInfo;
            } else {
                error = 1;
                reason = '未找到信息!';
            }
        } else {
            error = 1;
            reason = '无效的参数!';
        }

        return {
            error: error,
            reason: reason,
            result: result || {}
        }
    }

    // 删除
    async del(info = {}) {
        let reason = '', error = 0;
        let result = {};
        let { id = '', token = '' } = info;
        id = tools.encryptAndDecrypt(1, 3, id);

        let userInfo = await koacrab.models.user.find({
            field: ['id'],
            where: { token: token }
        });
        if (!userInfo.id) {
            error = 1;
            reason = '您无权限删除！'
        } else {
            let activityInfo = await koacrab.models.${tableNameCase}.find({
                where: { id }
            });

            if (activityInfo['user_id'] !== userInfo['id']) {
                return {
                    error: 1,
                    reason: '您不是创建者，无权限删除！',
                    result: ''
                }
            }

            let time = new Date().getTime();
            await koacrab.models.${tableNameCase}.update({
                data: { delete_time: time },
                where: { id }
            });
        }

        return {
            error: error,
            reason: '删除成功！',
            result: ''
        }
    }
}
`;
}



generateFiles().catch(error => {
    console.error('发生错误：', error);
});